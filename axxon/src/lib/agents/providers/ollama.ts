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
  schemaHint,
}: {
  messages: Array<{ role: string; content: string }>;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  failureMessage: string;
  schemaHint?: string;
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
    let validationSummary = 'Response did not match the required JSON schema.';

    try {
      const parsed = schema.safeParse(parseGeneratedJson(content));
      if (parsed.success) return parsed.data;

      validationSummary = summarizeZodIssues(parsed.error.issues).join('; ');
    } catch (error) {
      validationSummary = error instanceof Error ? error.message : validationSummary;
    }

    if (attemptIndex === 1) {
      throw new Error(`${failureMessage}: ${validationSummary}`);
    }

    attempts.push({
      role: 'user',
      content: [
        `Your last response did not match the required JSON schema: ${validationSummary}`,
        'Return only valid JSON for the exact requested shape.',
        schemaHint ? `Required JSON shape:\n${schemaHint}` : '',
      ].filter(Boolean).join('\n\n'),
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
  'If the latest user message is only a greeting, small talk, or lacks a concrete planning objective, respond with {"action":"respond"} and a concise assistantMessage asking what the user wants planned.',
  'Every response must include the top-level keys shown in the required JSON shape.',
  'Use null for unknown title or summary, {} for an empty contextPatch, and [] for empty arrays.',
  'Do not copy pipe-separated allowed-value lists into JSON values; choose one allowed enum value such as "scope" or "technical".',
  'contextPatch may include any known planning context fields: objective, summary, targetOutcome, inScope, outOfScope, assumptions, constraints, acceptanceCriteria, knownRequirements, unresolvedUnknowns, blockingUnknowns, affectedAreas, risks, dependencies, technicalDecisions, estimatedComplexity, and planningConfidence.',
  'Question categories must be one of scope, technical, constraints, dependencies, acceptance_criteria, priority, ux, or rollout.',
  'The decision must be {"action":"respond","reason":"missing_objective|low_confidence"}, {"action":"ask_questions","reason":"missing_objective|scope_unbounded|missing_acceptance_criteria|blocking_unknowns|low_confidence"} or {"action":"complete_planning","reason":"requirements_satisfied"}.',
  'Only use complete_planning when objective, scope, acceptance criteria, requirements, constraints, risks, and implementation-impacting unknowns are clear enough to generate a trustworthy implementation plan.',
  'If asking questions, include 1 to 3 candidateQuestions. Each candidate question must have exactly 3 concrete options and exactly one recommended option.',
  'Do not include none-of-the-above; Axxon adds that option server-side.',
  'Only request clarification when the current state exposes ask_clarification_questions in allowedTools.',
  'Do not generate the final plan in this stage.',
  'Use respond only for conversational replies that should not create structured question cards.',
  'Use stable lower-kebab-case questionKey values.',
].join(' ');

const PLANNING_ANALYSIS_JSON_SHAPE = `{
  "title": null,
  "summary": null,
  "assistantMessage": null,
  "contextPatch": {
    "objective": null,
    "summary": null,
    "targetOutcome": null,
    "inScope": [],
    "outOfScope": [],
    "assumptions": [],
    "constraints": [],
    "acceptanceCriteria": [],
    "knownRequirements": [],
    "unresolvedUnknowns": [],
    "blockingUnknowns": [],
    "affectedAreas": [],
    "risks": [],
    "dependencies": [],
    "technicalDecisions": [],
    "estimatedComplexity": null,
    "planningConfidence": 0
  },
  "knownRequirements": [],
  "unresolvedUnknowns": [],
  "blockingUnknowns": [],
  "resolvedQuestionKeys": [],
  "candidateQuestions": [],
  "confidence": 0,
  "decision": {
    "action": "respond|ask_questions|complete_planning",
    "reason": "missing_objective|scope_unbounded|missing_acceptance_criteria|blocking_unknowns|low_confidence|requirements_satisfied"
  }
}`;

const PLANNING_ARTIFACT_SYSTEM_PROMPT = [
  'You are Axxon Planning Agent.',
  'Return JSON only.',
  'Generate the final structured implementation plan from the completed planning context and transcript.',
  'Do not ask follow-up questions in this stage.',
  'The plan must include objective, requirements, scope, assumptions, constraints, affectedAreas, technicalDecisions, implementationPhases, risks, successCriteria, openQuestions, and notes.',
  'Each implementation phase must include id, title, summary, and implementation tasks with id, title, description, type, priority, dependencyIds, and acceptanceCriteria.',
  'Every response must include the top-level keys shown in the required JSON shape.',
].join(' ');

const PLANNING_ARTIFACT_JSON_SHAPE = `{
  "summary": "string",
  "objective": "string",
  "scope": {
    "inScope": [],
    "outOfScope": []
  },
  "requirements": [],
  "assumptions": [],
  "constraints": [],
  "affectedAreas": [],
  "technicalDecisions": [
    {
      "area": "string",
      "choice": "string",
      "rationale": "string",
      "source": "explicit|clarified|assumed"
    }
  ],
  "implementationPhases": [
    {
      "id": "lower-kebab-case",
      "title": "string",
      "summary": "string",
      "tasks": [
        {
          "id": "lower-kebab-case",
          "title": "string",
          "description": "string",
          "type": "string",
          "priority": "low|medium|high",
          "dependencyIds": [],
          "acceptanceCriteria": []
        }
      ]
    }
  ],
  "risks": [],
  "successCriteria": [],
  "openQuestions": [],
  "notes": []
}`;

// Runs the analysis stage that extracts context and returns the deterministic planning decision.
export async function analyzePlanningTurnWithOllama(
  run: AgentRun,
  messages: AgentProviderMessage[],
  allowedTools: AgentToolDefinition[]
): Promise<AgentPlanningTurnAnalysis> {
  return completeOllamaStructuredJson<AgentPlanningTurnAnalysis>({
    messages: [
      { role: 'system', content: `${PLANNING_ANALYSIS_SYSTEM_PROMPT}\n\nRequired JSON shape:\n${PLANNING_ANALYSIS_JSON_SHAPE}` },
      { role: 'user', content: buildPlanningPayload(run, messages, allowedTools) },
    ],
    schema: agentPlanningTurnAnalysisSchema,
    failureMessage: 'Failed to analyze the planning turn',
    schemaHint: PLANNING_ANALYSIS_JSON_SHAPE,
  });
}

// Runs the final plan stage after deterministic readiness permits completion.
export async function generatePlanWithOllama(
  run: AgentRun,
  messages: AgentProviderMessage[],
  allowedTools: AgentToolDefinition[]
): Promise<AgentPlanArtifact> {
  return completeOllamaStructuredJson<AgentPlanArtifact>({
    messages: [
      { role: 'system', content: `${PLANNING_ARTIFACT_SYSTEM_PROMPT}\n\nRequired JSON shape:\n${PLANNING_ARTIFACT_JSON_SHAPE}` },
      { role: 'user', content: buildPlanningPayload(run, messages, allowedTools) },
    ],
    schema: agentPlanArtifactSchema,
    failureMessage: 'Failed to generate the planning artifact',
    schemaHint: PLANNING_ARTIFACT_JSON_SHAPE,
  });
}
