// Implements the local Ollama planning adapter behind the unified agent-provider contract.
import type { AgentPlanArtifact, AgentQuestion, AgentRun } from '../domain';

type AgentPlanningResult = { questions?: AgentQuestion[]; artifact?: AgentPlanArtifact };

function getOllamaConfig() {
  const baseUrl = (process.env.AI_LOCAL_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = process.env.AI_LOCAL_MODEL || 'qwen2.5-coder:14b';
  return { baseUrl, model };
}

function fallbackPlan(run: AgentRun): AgentPlanArtifact {
  return {
    summary: run.prompt,
    implementationPhases: [{ title: 'Implementation', tasks: [{ title: run.title, acceptanceCriteria: ['Deliver the requested behavior', 'Add focused automated coverage'] }] }],
    assumptions: [],
    risks: [],
  };
}

function normalizeQuestions(value: unknown): AgentQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((question, index) => {
    if (!question || typeof question !== 'object') return [];
    const record = question as Record<string, unknown>;
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    if (!prompt) return [];
    return [{
      key: typeof record.key === 'string' && record.key.trim() ? record.key.trim() : `question_${index + 1}`,
      prompt,
      required: record.required !== false,
      options: Array.isArray(record.options)
        ? record.options.slice(0, 4).flatMap((option, optionIndex) => {
          if (!option || typeof option !== 'object') return [];
          const optionRecord = option as Record<string, unknown>;
          const label = typeof optionRecord.label === 'string' ? optionRecord.label.trim() : '';
          return label ? [{ key: typeof optionRecord.key === 'string' ? optionRecord.key : `option_${optionIndex + 1}`, label }] : [];
        })
        : [],
    }];
  });
}

function normalizeArtifact(value: unknown, run: AgentRun): AgentPlanArtifact | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
  if (!summary) return null;
  return {
    summary,
    implementationPhases: Array.isArray(record.implementationPhases) ? record.implementationPhases as AgentPlanArtifact['implementationPhases'] : fallbackPlan(run).implementationPhases,
    assumptions: Array.isArray(record.assumptions) ? record.assumptions.filter((item): item is string => typeof item === 'string') : [],
    risks: Array.isArray(record.risks) ? record.risks.filter((item): item is string => typeof item === 'string') : [],
  };
}

function parseJson(content: string) {
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(content.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function planWithOllama(run: AgentRun, messages: Array<{ role: string; content: string }>): Promise<AgentPlanningResult> {
  const { baseUrl, model } = getOllamaConfig();
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [{
        role: 'system',
        content: 'Return JSON only. If essential implementation details are missing, return {"questions":[{"key":"scope","prompt":"...","required":true,"options":[{"key":"default","label":"Use recommended default"}]}]}. Otherwise return {"artifact":{"summary":"...","implementationPhases":[{"title":"...","tasks":[{"title":"...","acceptanceCriteria":["..."]}]}],"assumptions":[],"risks":[]}}.',
      }, {
        role: 'user',
        content: `Create a reviewable software-delivery plan for: ${run.prompt}\n\nConversation:\n${messages.map((message) => `${message.role}: ${message.content}`).join('\n')}`,
      }],
    }),
  });
  if (!response.ok) throw new Error(`Ollama planning request failed with ${response.status}`);
  const body = await response.json() as { message?: { content?: string } };
  const parsed = parseJson(body.message?.content ?? '');
  if (!parsed) return { artifact: fallbackPlan(run) };
  const questions = normalizeQuestions(parsed.questions);
  if (questions.length > 0) return { questions };
  return { artifact: normalizeArtifact(parsed.artifact, run) ?? fallbackPlan(run) };
}
