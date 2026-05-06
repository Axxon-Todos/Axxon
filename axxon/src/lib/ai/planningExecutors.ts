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
import { ServiceUnavailableError } from '@/lib/utils/apiErrors';

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
      baseUrl: runtime.baseUrl ?? 'http://127.0.0.1:11434',
      model: runtime.model,
    });
  },
  analyzeTurn: analyzePlanningTurn,
  generateClarificationQuestions: generatePlanningClarificationQuestions,
  generatePlan: generatePlanningArtifact,
};

const externalPlanningExecutor: PlanningExecutor = {
  kind: 'external_llm',
  async assertReady() {
    const runtime = getAiRuntimeConfig();

    if (runtime.provider !== 'openai-compatible' || !runtime.available) {
      throw new ServiceUnavailableError(
        'External AI provider is not configured for this environment'
      );
    }
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

  if (executorKind === 'external_llm') {
    return externalPlanningExecutor;
  }

  throw new Error(`Planning executor "${executorKind}" is not available yet`);
}

export function resolveDefaultPlanningExecutorKind(): PlanningExecutorKind {
  const runtime = getAiRuntimeConfig();

  return runtime.useLocalProvider ? 'local_ollama' : 'external_llm';
}
