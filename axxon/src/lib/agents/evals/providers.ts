// Provides eval-only planning provider adapters for fixtures, local Ollama, and OpenAI-compatible cloud runtimes.
import { z } from 'zod';
import {
  analyzePlanningTurnWithOllama,
  buildPlanningArtifactMessages,
  buildPlanningAnalysisMessages,
  generatePlanWithOllama,
} from '../providers/ollama';
import {
  agentPlanArtifactSchema,
  agentPlanningTurnAnalysisSchema,
} from '../domain/schemas';
import type {
  AgentPlanArtifact,
  AgentPlanningQuality,
  AgentPlanningTurnAnalysis,
  AgentRun,
} from '../domain/contracts';
import type { AgentToolDefinition } from '../toolCalls/registry';
import {
  planningEvalProviders,
  type PlanningEvalCase,
  type PlanningEvalMessage,
  type PlanningEvalProviderName,
} from './types';

export type PlanningEvalProviderRequest = {
  case: PlanningEvalCase;
  run: AgentRun;
  messages: PlanningEvalMessage[];
  allowedTools: AgentToolDefinition[];
};

export type PlanningEvalPlanRequest = PlanningEvalProviderRequest & {
  qualityFeedback?: AgentPlanningQuality;
};

export type PlanningEvalProvider = {
  name: PlanningEvalProviderName;
  analyze(request: PlanningEvalProviderRequest): Promise<AgentPlanningTurnAnalysis>;
  generatePlan(request: PlanningEvalPlanRequest): Promise<AgentPlanArtifact>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function parseGeneratedJson(content: string) {
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  const candidate = first >= 0 && last > first ? content.slice(first, last + 1) : content;
  return JSON.parse(candidate) as unknown;
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for cloud planning eval provider`);
  return value;
}

// Creates a provider that replays committed fixture outputs for stable CI runs.
export function createFixturePlanningEvalProvider(evalCase: PlanningEvalCase): PlanningEvalProvider {
  let analysisIndex = 0;
  let planArtifactIndex = 0;

  return {
    name: 'fixture',
    async analyze() {
      const analysis = evalCase.fixture?.analyses[analysisIndex];
      if (!analysis) throw new Error(`Fixture case "${evalCase.id}" has no analysis output at index ${analysisIndex}`);
      analysisIndex += 1;
      return analysis;
    },
    async generatePlan() {
      const artifact = evalCase.fixture?.planArtifacts[planArtifactIndex];
      if (!artifact) throw new Error(`Fixture case "${evalCase.id}" has no plan artifact output at index ${planArtifactIndex}`);
      planArtifactIndex += 1;
      return artifact;
    },
  };
}

// Creates a provider backed by the app's current local Ollama adapter.
export function createOllamaPlanningEvalProvider(): PlanningEvalProvider {
  return {
    name: 'ollama',
    analyze: ({ run, messages, allowedTools }) => analyzePlanningTurnWithOllama(run, messages, allowedTools),
    generatePlan: ({ run, messages, allowedTools, qualityFeedback }) =>
      generatePlanWithOllama(run, messages, allowedTools, qualityFeedback),
  };
}

async function completeCloudStructuredJson<T>({
  messages,
  schema,
}: {
  messages: Array<{ role: string; content: string }>;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
}) {
  const baseUrl = readRequiredEnv('EVAL_PROVIDER_BASE_URL').replace(/\/+$/, '');
  const model = readRequiredEnv('EVAL_PROVIDER_MODEL');
  const apiKey = readRequiredEnv('EVAL_PROVIDER_API_KEY');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) throw new Error(`Cloud planning eval provider failed with ${response.status}`);
  const body = await response.json() as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = schema.safeParse(parseGeneratedJson(content));
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${issuePath}: ${issue.message}`;
  }).join('; ');
  throw new Error(`Cloud planning eval provider returned invalid JSON: ${issues}`);
}

// Creates an OpenAI-compatible chat-completions provider for staging and release evals.
export function createCloudPlanningEvalProvider(): PlanningEvalProvider {
  return {
    name: 'cloud',
    analyze: ({ run, messages, allowedTools }) =>
      completeCloudStructuredJson({
        messages: buildPlanningAnalysisMessages(run, messages, allowedTools),
        schema: agentPlanningTurnAnalysisSchema,
      }),
    generatePlan: ({ run, messages, allowedTools, qualityFeedback }) =>
      completeCloudStructuredJson({
        messages: buildPlanningArtifactMessages(run, messages, allowedTools, qualityFeedback),
        schema: agentPlanArtifactSchema,
      }),
  };
}

// Selects the eval provider requested by CLI args or environment defaults.
export function createPlanningEvalProvider(name: PlanningEvalProviderName, evalCase: PlanningEvalCase) {
  if (name === 'fixture') return createFixturePlanningEvalProvider(evalCase);
  if (name === 'ollama') return createOllamaPlanningEvalProvider();
  return createCloudPlanningEvalProvider();
}

// Validates provider names for CLI use.
export function parsePlanningEvalProviderName(value: string): PlanningEvalProviderName {
  const parsed = z.enum(planningEvalProviders).safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unknown planning eval provider "${value}". Use one of: ${planningEvalProviders.join(', ')}`);
  }

  return parsed.data;
}
