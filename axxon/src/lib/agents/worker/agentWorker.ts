// Runs durable agent jobs independently from Socket.IO and advances runs through the state machine.
import db from '@/lib/db/db';
import {
  applyWorkerPlanningAnalysis,
  claimAgentRunForWork,
  completeWorkerPlanning,
  deliverAgentDispatch,
  failAgentRun,
  startAgentPlanningTurn,
  supersedeWorkerPlanning,
} from '../application/runService';
import { AgentRepository } from '../infrastructure/repository';
import { analyzePlanningTurnWithOllama, generatePlanWithOllama } from '../providers/ollama';
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
        const planArtifact = await generatePlanWithOllama(
          outcome.run,
          mapProviderMessages(planMessages),
          getAllowedAgentToolsForState(outcome.run.state)
        );
        if (await hasNewerUserMessage(outcome.run.id, latestPlanMessageId)) {
          await supersedeWorkerPlanning(outcome.run.id);
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
    const message = error instanceof Error ? error.message : 'Agent worker failed';
    await failAgentRun(Number(job.run_id), message);
    await AgentRepository.finishJob(Number(job.id), message);
  }

  return true;
}

export async function runAgentWorker(signal: AbortSignal) {
  while (!signal.aborted) {
    const processed = await processNextAgentJob();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
