// Resolves the planning executor contract so persisted planning runs can target different backends over time.
import { getAiRuntimeConfig } from '@/lib/ai/config';
import { ensureLocalOllamaPlanningReady } from '@/lib/ai/localOllamaRuntime';
import {
  analyzePlanningTurn,
  generatePlanningArtifact,
  generatePlanningClarificationQuestions,
} from '@/lib/ai/planning';
import type {
  PlanningContext,
  PlanningExecutorKind,
  PlanningPlanArtifact,
  PlanningQuestion,
  PlanningQuestionCandidate,
  PlanningReadiness,
  PlanningTurnAnalysis,
} from '@/lib/types/organizationAiPlanningTypes';

type PlanningExecutorInput = {
  sessionTitle: string;
  originalPrompt: string;
  context: PlanningContext;
  readiness: PlanningReadiness;
  questions: PlanningQuestion[];
  messages: Array<Record<string, unknown>>;
};

export type PlanningExecutor = {
  kind: PlanningExecutorKind;
  assertReady: () => Promise<void>;
  analyzeTurn: (input: PlanningExecutorInput) => Promise<PlanningTurnAnalysis>;
  generateClarificationQuestions: (
    input: PlanningExecutorInput
  ) => Promise<PlanningQuestionCandidate[]>;
  generatePlan: (input: PlanningExecutorInput) => Promise<PlanningPlanArtifact>;
};

const localOllamaPlanningExecutor: PlanningExecutor = {
  kind: 'local_ollama',
  async assertReady() {
    const runtime = getAiRuntimeConfig();

    await ensureLocalOllamaPlanningReady({
      baseUrl: runtime.localBaseUrl,
      model: runtime.model,
    });
  },
  analyzeTurn: analyzePlanningTurn,
  generateClarificationQuestions: generatePlanningClarificationQuestions,
  generatePlan: generatePlanningArtifact,
};

export function resolvePlanningExecutor(
  executorKind: PlanningExecutorKind
): PlanningExecutor {
  if (executorKind === 'local_ollama') {
    return localOllamaPlanningExecutor;
  }

  throw new Error(`Planning executor "${executorKind}" is not available yet`);
}

export function resolveDefaultPlanningExecutorKind(): PlanningExecutorKind {
  const runtime = getAiRuntimeConfig();

  return runtime.useLocalProvider ? 'local_ollama' : 'external_llm';
}
