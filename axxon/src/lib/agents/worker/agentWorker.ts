// Runs durable agent jobs independently from Socket.IO and advances runs through the state machine.
import { z } from 'zod';
import db from '@/lib/db/db';
import {
  applyWorkerPlanningAnalysis,
  claimAgentRunForWork,
  completeWorkerPlanning,
  deliverAgentDispatch,
  failAgentRun,
  requestWorkerPlanQualityInput,
  startAgentPlanningTurn,
  supersedeWorkerPlanning,
} from '../application/runService';
import { attachPlanArtifactQuality, buildFallbackPlanArtifact } from '../domain';
import { AgentRepository } from '../infrastructure/repository';
import { Architecture } from '@/lib/models/architecture';
import { buildArchitectureContext } from '../architecture/context';
import { architectureProposalToPlanArtifact, generateArchitectureProposalWithOllama } from '../architecture/provider';
import { buildArchitectureChangeSet, ArchitectureChangeSets } from '../architecture/changeSets';
import { architectureDiscoveryQuestions, getArchitectureDiscoveryQuestions } from '../architecture/requirements';
import { ArchitectureRequirements } from '@/lib/models/architectureRequirements';
import { AgentProviderValidationError, analyzePlanningTurnWithOllama, generatePlanWithOllama } from '../providers/ollama';
import { getAllowedAgentToolsForState } from '../toolCalls/registry';

const workerId = `agent-worker-${process.pid}`;

function mapProviderMessages(messages: Awaited<ReturnType<typeof AgentRepository.listMessages>>) {
  return messages.map((message) => ({
    role: String(message.role),
    content: String(message.content),
    metadata: message.metadata,
  }));
}

async function hasNewerUserMessage(runId: number, latestMessageId: number) {
  return await AgentRepository.getLatestMessageId(runId) !== latestMessageId;
}

// Converts Zod paths into compact strings suitable for persisted diagnostics.
function summarizeZodIssuePaths(error: z.ZodError) {
  return error.issues.slice(0, 10).map((issue) => issue.path.length > 0 ? issue.path.join('.') : 'root');
}

// Keeps validation diagnostics useful without exposing large JSON blobs in the run message.
function summarizeZodDiagnostics(error: z.ZodError) {
  return error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
}

// Converts provider-format failures into concise user copy and compact persisted diagnostics.
function serializeWorkerError(error: unknown) {
  if (error instanceof AgentProviderValidationError) {
    const providerValidation = {
      ...error.details,
      retryable: true,
    };

    return {
      userMessage: 'The planning provider returned an invalid response format. Retry this run to generate the plan again.',
      eventPayload: {
        category: 'provider_validation',
        providerValidation,
      },
      jobError: JSON.stringify({
        message: error.message,
        category: 'provider_validation',
        providerValidation,
      }),
    };
  }

  if (error instanceof z.ZodError) {
    const validation = {
      phase: 'worker_state_validation',
      issuePaths: summarizeZodIssuePaths(error),
      diagnostics: summarizeZodDiagnostics(error),
      retryable: true,
    };

    return {
      userMessage: 'The planning run contained invalid structured state. Retry this run to repair saved context and generate the plan again.',
      eventPayload: {
        category: 'worker_state_validation',
        validation,
      },
      jobError: JSON.stringify({
        message: 'Worker state validation failed',
        category: 'worker_state_validation',
        validation,
      }),
    };
  }

  const message = error instanceof Error ? error.message : 'Agent worker failed';
  return {
    userMessage: message,
    eventPayload: null,
    jobError: message,
  };
}

export async function processNextAgentJob() {
  const job = await db.transaction(async (trx) => {
    await AgentRepository.requeueStaleJobs(new Date(Date.now() - 5 * 60_000), trx);
    return AgentRepository.claimJob(workerId, trx);
  });
  if (!job) return false;

  try {
    const run = await AgentRepository.getRun(Number(job.run_id));
    if (!run) throw new Error('Agent run not found');
    if (job.kind === 'prepare') {
      const claimedRun = await claimAgentRunForWork(run.id);
      if (!claimedRun) {
        await AgentRepository.finishJob(Number(job.id), null);
        return true;
      }
      const planningRun = await startAgentPlanningTurn(claimedRun.id);
      if (!planningRun) {
        await AgentRepository.finishJob(Number(job.id), null);
        return true;
      }
      if (planningRun.projectId) {
        const projectRequirements = await ArchitectureRequirements.list(planningRun.projectId);
        if (planningRun.architectureIntent === 'bootstrap' && projectRequirements.length === 0) {
          const discoveryRun = await db.transaction(async (trx) => {
            const locked = await AgentRepository.lockRun(planningRun.id, trx);
            if (!locked || locked.state !== 'planning') return null;
            const updated = await AgentRepository.updateRun(locked.id, locked.version, { state: 'awaiting_input', questions: getArchitectureDiscoveryQuestions() }, trx);
            await AgentRepository.addMessage(locked.id, 'assistant', 'Before I design the system, I need a few decisions about security, reliability, infrastructure, and data. You can answer in plain language; technical details are optional.', { kind: 'architecture_discovery', categories: architectureDiscoveryQuestions.map((question) => question.requirementCategory) }, trx);
            await AgentRepository.appendEvent({ runId: locked.id, type: 'input.required', fromState: locked.state, toState: updated.state, actorType: 'worker', payload: { phase: 'requirements_discovery', questionCount: architectureDiscoveryQuestions.length } }, trx);
            await AgentRepository.appendEvent({ runId: locked.id, type: 'architecture.progress', fromState: updated.state, toState: updated.state, actorType: 'worker', payload: { phase: 'requirements_discovery', status: 'awaiting_answers' } }, trx);
            return updated;
          });
          await AgentRepository.finishJob(Number(job.id), null);
          return Boolean(discoveryRun);
        }
        const revisions = await Architecture.listRevisions(planningRun.projectId);
        // A historical target can guide context, but proposals must always hash the current draft.
        const revisionId = Number(revisions[0]?.id || 0);
        const context = await buildArchitectureContext(planningRun.projectId, revisionId, planningRun.targetContext as never);
        const messages = await AgentRepository.listMessages(planningRun.id);
        context.reviewerFeedback = messages.filter((message) => message.metadata && typeof message.metadata === 'object' && (message.metadata as Record<string, unknown>).kind === 'architecture_change_request').map((message) => message.content);
        await AgentRepository.appendEvent({ runId: planningRun.id, type: 'architecture.progress', fromState: planningRun.state, toState: planningRun.state, actorType: 'worker', payload: { phase: 'proposal_generation', status: 'started' } });
        const proposal = await generateArchitectureProposalWithOllama(planningRun, context);
        await AgentRepository.appendEvent({ runId: planningRun.id, type: 'architecture.progress', fromState: planningRun.state, toState: planningRun.state, actorType: 'worker', payload: { phase: 'preview_generation', status: 'started' } });
        const changeSet = await db.transaction(async (trx) => {
          const preview = await buildArchitectureChangeSet(planningRun.projectId!, planningRun.id, planningRun.createdBy, proposal, context.graph);
          return ArchitectureChangeSets.create(preview, trx);
        });
        await completeWorkerPlanning(planningRun.id, architectureProposalToPlanArtifact(proposal), { action: 'complete_planning', reason: 'requirements_satisfied' });
        await AgentRepository.appendEvent({ runId: planningRun.id, type: 'architecture.progress', fromState: 'awaiting_plan_review', toState: 'awaiting_plan_review', actorType: 'worker', payload: { phase: 'preview_ready', changeSetId: changeSet.id, semanticDiff: changeSet.semantic_diff_json, impactFindings: changeSet.impact_findings_json } });
        await AgentRepository.finishJob(Number(job.id), null);
        return true;
      }
      const messages = await AgentRepository.listMessages(planningRun.id);
      const latestMessageId = await AgentRepository.getLatestMessageId(planningRun.id);
      const mappedMessages = mapProviderMessages(messages);
      const analysis = await analyzePlanningTurnWithOllama(
        planningRun,
        mappedMessages,
        getAllowedAgentToolsForState(planningRun.state)
      );
      if (await hasNewerUserMessage(planningRun.id, latestMessageId)) {
        await supersedeWorkerPlanning(planningRun.id);
        await AgentRepository.finishJob(Number(job.id), null);
        return true;
      }
      const outcome = await applyWorkerPlanningAnalysis(run.id, analysis);
      if (outcome?.action === 'generate_plan') {
        const planMessages = await AgentRepository.listMessages(outcome.run.id);
        const latestPlanMessageId = await AgentRepository.getLatestMessageId(outcome.run.id);
        let planArtifact = await generatePlanWithOllama(
          outcome.run,
          mapProviderMessages(planMessages),
          getAllowedAgentToolsForState(outcome.run.state)
        );
        planArtifact = attachPlanArtifactQuality({
          artifact: planArtifact,
          context: outcome.run.planningContext,
          prompt: outcome.run.prompt,
        });
        if (!planArtifact.quality?.passed) {
          planArtifact = await generatePlanWithOllama(
            outcome.run,
            mapProviderMessages(planMessages),
            getAllowedAgentToolsForState(outcome.run.state),
            planArtifact.quality
          );
          planArtifact = attachPlanArtifactQuality({
            artifact: planArtifact,
            context: outcome.run.planningContext,
            prompt: outcome.run.prompt,
          });
        }
        if (await hasNewerUserMessage(outcome.run.id, latestPlanMessageId)) {
          await supersedeWorkerPlanning(outcome.run.id);
          await AgentRepository.finishJob(Number(job.id), null);
          return true;
        }
        const rejectedQuality = planArtifact.quality;
        if (!rejectedQuality?.passed) {
          const fallbackArtifact = buildFallbackPlanArtifact({
            prompt: outcome.run.prompt,
            context: outcome.run.planningContext,
          });
          if (fallbackArtifact) {
            const qualifiedFallbackArtifact = attachPlanArtifactQuality({
              artifact: fallbackArtifact,
              context: outcome.run.planningContext,
              prompt: outcome.run.prompt,
            });
            if (qualifiedFallbackArtifact.quality?.passed) {
              await completeWorkerPlanning(run.id, qualifiedFallbackArtifact, outcome.decision);
              await AgentRepository.finishJob(Number(job.id), null);
              return true;
            }
          }
          if (!rejectedQuality) throw new Error('Plan quality evaluation did not produce a result');
          await requestWorkerPlanQualityInput(run.id, rejectedQuality);
          await AgentRepository.finishJob(Number(job.id), null);
          return true;
        }
        await completeWorkerPlanning(run.id, planArtifact, outcome.decision);
      }
    } else if (job.kind === 'dispatch') {
      await deliverAgentDispatch(run.id);
    } else {
      throw new Error(`Unsupported agent job kind: ${job.kind}`);
    }
    await AgentRepository.finishJob(Number(job.id), null);
  } catch (error) {
    const serialized = serializeWorkerError(error);
    await failAgentRun(Number(job.run_id), serialized.userMessage, serialized.eventPayload);
    await AgentRepository.finishJob(Number(job.id), serialized.jobError);
  }

  return true;
}

export async function runAgentWorker(signal: AbortSignal) {
  while (!signal.aborted) {
    const processed = await processNextAgentJob();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
