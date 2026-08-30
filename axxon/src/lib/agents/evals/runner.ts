// Executes planning-agent eval cases through the same domain rules used by durable agent runs.
import {
  applyClarificationAnswersToContext,
  assertAgentTransition,
  attachPlanArtifactQuality,
  buildFallbackPlanArtifact,
  buildPlanQualityFeedback,
  createEmptyPlanningContext,
  createInitialPlanningReadiness,
  evaluatePlanningReadiness,
  mergePlanningContext,
  normalizeAgentQuestionKey,
  type AgentPlanArtifact,
  type AgentPlanningQuality,
  type AgentRun,
  type AgentRunEventType,
  type AgentRunState,
} from '../domain';
import { getAllowedAgentToolsForState } from '../toolCalls/registry';
import { executeAgentTool } from '../toolCalls/registry';
import type { PlanningEvalCase, PlanningEvalMessage, PlanningEvalTrace, PlanningEvalTransition } from './types';
import type { PlanningEvalProvider } from './providers';

const MAX_EVAL_TURNS = 5;

function createEvalRun(evalCase: PlanningEvalCase): AgentRun {
  const timestamp = '2026-01-01T00:00:00.000Z';

  return {
    id: 1,
    organizationId: 1,
    boardId: 1,
    createdBy: 1,
    runType: 'planning',
    title: evalCase.prompt.replace(/\s+/g, ' ').trim().slice(0, 120),
    prompt: evalCase.prompt,
    state: 'queued',
    version: 1,
    questions: [],
    planningContext: createEmptyPlanningContext(),
    readiness: createInitialPlanningReadiness(),
    clarificationTurnCount: 0,
    planArtifact: null,
    failureMessage: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function updateRun(run: AgentRun, update: Partial<AgentRun>): AgentRun {
  return {
    ...run,
    ...update,
    version: run.version + 1,
  };
}

function transition(
  run: AgentRun,
  event: AgentRunEventType,
  transitions: PlanningEvalTransition[],
  update: Partial<AgentRun> = {}
) {
  const nextState = assertAgentTransition(run.state, event);
  transitions.push({ event, fromState: run.state, toState: nextState });
  return updateRun(run, { state: nextState, ...update });
}

function countAnsweredQuestions(messages: PlanningEvalMessage[]) {
  return messages.reduce((count, message) => {
    const answers = message.metadata?.answers;
    return Array.isArray(answers) ? count + answers.length : count;
  }, 0);
}

function normalizeEvalAnswers(answers: PlanningEvalCase['clarificationAnswers'][number]) {
  return answers.map((answer) => ({
    ...answer,
    questionKey: normalizeAgentQuestionKey(answer.questionKey),
    selectedOptionKey: normalizeAgentQuestionKey(answer.selectedOptionKey),
    note: answer.note?.trim() || null,
  }));
}

function addMessage(messages: PlanningEvalMessage[], role: PlanningEvalMessage['role'], content: string, metadata?: Record<string, unknown>) {
  messages.push({ role, content, metadata: metadata ?? null });
}

async function generateQualifiedPlan({
  provider,
  evalCase,
  run,
  messages,
  quality,
}: {
  provider: PlanningEvalProvider;
  evalCase: PlanningEvalCase;
  run: AgentRun;
  messages: PlanningEvalMessage[];
  quality?: AgentPlanningQuality;
}) {
  const generated = await provider.generatePlan({
    case: evalCase,
    run,
    messages,
    allowedTools: getAllowedAgentToolsForState(run.state),
    qualityFeedback: quality,
  });

  return attachPlanArtifactQuality({
    artifact: generated,
    context: run.planningContext,
    prompt: run.prompt,
  });
}

async function finishPlanGeneration({
  provider,
  evalCase,
  run,
  messages,
}: {
  provider: PlanningEvalProvider;
  evalCase: PlanningEvalCase;
  run: AgentRun;
  messages: PlanningEvalMessage[];
}) {
  let retryCount = 0;
  let fallbackUsed = false;
  let artifact = await generateQualifiedPlan({ provider, evalCase, run, messages });

  if (artifact.quality && !artifact.quality.passed) {
    retryCount += 1;
    artifact = await generateQualifiedPlan({
      provider,
      evalCase,
      run,
      messages: [
        ...messages,
        {
          role: 'user',
          content: buildPlanQualityFeedback(artifact.quality, { prompt: run.prompt, context: run.planningContext }),
          metadata: { kind: 'quality_feedback' },
        },
      ],
      quality: artifact.quality,
    });
  }

  if (!artifact.quality?.passed) {
    const fallbackArtifact = buildFallbackPlanArtifact({ prompt: run.prompt, context: run.planningContext });
    if (fallbackArtifact) {
      const qualifiedFallbackArtifact = attachPlanArtifactQuality({
        artifact: fallbackArtifact,
        context: run.planningContext,
        prompt: run.prompt,
      });
      if (qualifiedFallbackArtifact.quality?.passed) {
        artifact = qualifiedFallbackArtifact;
        fallbackUsed = true;
      }
    }
  }

  return { artifact: artifact as AgentPlanArtifact, retryCount, fallbackUsed };
}

// Runs one eval case and returns the observed planning trace.
export async function runPlanningEvalCase(evalCase: PlanningEvalCase, provider: PlanningEvalProvider): Promise<PlanningEvalTrace> {
  const startedAt = new Date().toISOString();
  const transitions: PlanningEvalTransition[] = [];
  const analyses: PlanningEvalTrace['analyses'] = [];
  const messages: PlanningEvalMessage[] = evalCase.messages.length > 0
    ? [...evalCase.messages]
    : [{ role: 'user', content: evalCase.prompt, metadata: null }];
  let run = createEvalRun(evalCase);
  let retryCount = 0;
  let fallbackUsed = false;
  let finalDecisionAction: PlanningEvalTrace['finalDecisionAction'] = null;
  let failureMessage: string | null = null;
  let answerBatchIndex = 0;

  try {
    for (let turnIndex = 0; turnIndex < MAX_EVAL_TURNS; turnIndex += 1) {
      run = transition(run, 'worker.claimed', transitions);
      run = transition(run, 'planning.started', transitions);

      const analysis = await provider.analyze({
        case: evalCase,
        run,
        messages,
        allowedTools: getAllowedAgentToolsForState(run.state),
      });
      analyses.push(analysis);
      finalDecisionAction = analysis.decision.action;

      const planningContext = mergePlanningContext(run.planningContext, analysis);
      const readiness = evaluatePlanningReadiness({
        analysis,
        context: planningContext,
        answeredQuestionCount: countAnsweredQuestions(messages),
      });
      run = updateRun(run, { planningContext, readiness });

      if (analysis.decision.action === 'respond') {
        addMessage(messages, 'assistant', analysis.assistantMessage || 'What would you like me to plan?', { kind: 'planning_prompt' });
        run = transition(run, 'message.required', transitions, { questions: [], planningContext, readiness });
        break;
      }

      if (readiness.recommendedNextAction === 'complete_planning') {
        const planResult = await finishPlanGeneration({ provider, evalCase, run, messages });
        retryCount += planResult.retryCount;
        fallbackUsed = planResult.fallbackUsed;
        run = transition(run, 'plan.generated', transitions, {
          planArtifact: planResult.artifact,
          questions: [],
          planningContext,
          readiness,
        });
        addMessage(messages, 'assistant', `Plan generated.\n\n${planResult.artifact.summary}`, {
          kind: 'plan_summary',
          quality: planResult.artifact.quality,
        });
        break;
      }

      const toolResult = executeAgentTool({
        toolName: 'ask_clarification_questions',
        state: run.state,
        input: {
          candidateQuestions: analysis.candidateQuestions,
          existingQuestions: run.questions,
          planningContext,
          prompt: run.prompt,
          readiness,
        },
      });

      if (toolResult.questions.length === 0) {
        addMessage(messages, 'assistant', 'Add any remaining constraints, edge cases, or delivery expectations in a message so I can finish the implementation plan.', {
          kind: 'planning_prompt',
        });
        run = transition(run, 'message.required', transitions, { questions: [], planningContext, readiness });
        break;
      }

      run = transition(run, 'input.required', transitions, {
        questions: toolResult.questions,
        planningContext,
        readiness,
        clarificationTurnCount: run.clarificationTurnCount + 1,
      });

      const answerBatch = evalCase.clarificationAnswers[answerBatchIndex];
      if (!answerBatch) break;

      const answers = normalizeEvalAnswers(answerBatch);
      const nextContext = applyClarificationAnswersToContext({ context: run.planningContext, questions: run.questions, answers });
      addMessage(messages, 'user', 'Clarification answers submitted by eval fixture.', { answers });
      answerBatchIndex += 1;
      run = transition(run, 'input.submitted', transitions, { questions: [], planningContext: nextContext });
    }
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error);
    const fromState = run.state;
    const failedState: AgentRunState = 'failed';
    transitions.push({ event: 'run.failed', fromState, toState: failedState });
    run = updateRun(run, { state: failedState, failureMessage });
  }

  return {
    caseId: evalCase.id,
    provider: provider.name,
    finalState: run.state,
    finalDecisionAction,
    transitions,
    messages,
    analyses,
    questions: run.questions,
    quality: run.planArtifact?.quality ?? null,
    planArtifact: run.planArtifact,
    retryCount,
    fallbackUsed,
    failureMessage,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
