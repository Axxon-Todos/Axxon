// Implements structured local Ollama calls for planning analysis and final plan generation.
import { z } from 'zod';
import type { AgentPlanArtifact, AgentPlanningTurnAnalysis, AgentRun } from '../domain';
import { agentPlanArtifactSchema, agentPlanningTurnAnalysisSchema } from '../domain';
import type { AgentToolDefinition } from '../toolCalls/registry';

type AgentProviderMessage = { role: string; content: string; metadata?: unknown };

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

function getOllamaConfig() {
  const baseUrl = (process.env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = process.env.AI_LOCAL_MODEL || 'qwen2.5-coder:14b';
  return { baseUrl, model };
}

function parseGeneratedJson(content: string) {
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  const candidate = first >= 0 && last > first ? content.slice(first, last + 1) : content;
  return JSON.parse(candidate) as unknown;
}

function summarizeZodIssues(issues: z.ZodIssue[]) {
  return issues.slice(0, 5).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
}

async function completeOllamaStructuredJson<T>({
  messages,
  schema,
  failureMessage,
}: {
  messages: Array<{ role: string; content: string }>;
  schema: z.ZodSchema<T>;
  failureMessage: string;
}) {
  const { baseUrl, model } = getOllamaConfig();
  const attempts = [...messages];

  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: attempts,
      }),
    });

    if (!response.ok) throw new Error(`Ollama planning request failed with ${response.status}`);

    const body = await response.json() as OllamaChatResponse;
    const content = body.message?.content?.trim() ?? '';

    try {
      const parsed = schema.safeParse(parseGeneratedJson(content));
      if (parsed.success) return parsed.data;

      if (attemptIndex === 1) {
        throw new Error(`${failureMessage}: ${summarizeZodIssues(parsed.error.issues).join('; ')}`);
      }
    } catch (error) {
      if (attemptIndex === 1) {
        throw error instanceof Error ? error : new Error(failureMessage);
      }
    }

    attempts.push({
      role: 'user',
      content: 'Your last response did not match the required JSON schema. Return only valid JSON for the requested shape.',
    });
  }

  throw new Error(failureMessage);
}

function buildPlanningPayload(run: AgentRun, messages: AgentProviderMessage[], allowedTools: AgentToolDefinition[]) {
  return JSON.stringify({
    run: {
      id: run.id,
      title: run.title,
      prompt: run.prompt,
      planningContext: run.planningContext,
      readiness: run.readiness,
      clarificationTurnCount: run.clarificationTurnCount,
      activeQuestions: run.questions,
    },
    allowedTools: allowedTools.map((tool) => ({
      name: tool.name,
      label: tool.label,
      description: tool.description,
    })),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
      metadata: message.metadata ?? null,
    })),
  }, null, 2);
}

const PLANNING_ANALYSIS_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'Return JSON only.',
  'Analyze the current planning run and decide whether to ask structured clarification questions or complete planning.',
  'The decision must be {"action":"ask_questions","reason":"missing_objective|scope_unbounded|missing_acceptance_criteria|blocking_unknowns|low_confidence"} or {"action":"complete_planning","reason":"requirements_satisfied"}.',
  'Only use complete_planning when objective, scope, acceptance criteria, requirements, constraints, risks, and implementation-impacting unknowns are clear enough to generate a trustworthy implementation plan.',
  'If asking questions, include 1 to 3 candidateQuestions. Each candidate question must have exactly 3 concrete options and exactly one recommended option.',
  'Do not include none-of-the-above; Axxon adds that option server-side.',
  'Only request clarification when the current state exposes ask_clarification_questions in allowedTools.',
  'Do not generate the final plan in this stage.',
  'Use stable lower-kebab-case questionKey values.',
].join(' ');

const PLANNING_ARTIFACT_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'Return JSON only.',
  'Generate the final structured implementation plan from the completed planning context and transcript.',
  'Do not ask follow-up questions in this stage.',
  'The plan must include objective, requirements, scope, assumptions, constraints, affectedAreas, technicalDecisions, implementationPhases, risks, successCriteria, openQuestions, and notes.',
  'Each implementation phase must include id, title, summary, and implementation tasks with id, title, description, type, priority, dependencyIds, and acceptanceCriteria.',
].join(' ');

// Runs the analysis stage that extracts context and returns the deterministic planning decision.
export async function analyzePlanningTurnWithOllama(
  run: AgentRun,
  messages: AgentProviderMessage[],
  allowedTools: AgentToolDefinition[]
): Promise<AgentPlanningTurnAnalysis> {
  return completeOllamaStructuredJson({
    messages: [
      { role: 'system', content: PLANNING_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: buildPlanningPayload(run, messages, allowedTools) },
    ],
    schema: agentPlanningTurnAnalysisSchema,
    failureMessage: 'Failed to analyze the planning turn',
  });
}

// Runs the final plan stage after deterministic readiness permits completion.
export async function generatePlanWithOllama(
  run: AgentRun,
  messages: AgentProviderMessage[],
  allowedTools: AgentToolDefinition[]
): Promise<AgentPlanArtifact> {
  return completeOllamaStructuredJson({
    messages: [
      { role: 'system', content: PLANNING_ARTIFACT_SYSTEM_PROMPT },
      { role: 'user', content: buildPlanningPayload(run, messages, allowedTools) },
    ],
    schema: agentPlanArtifactSchema,
    failureMessage: 'Failed to generate the planning artifact',
  });
}
