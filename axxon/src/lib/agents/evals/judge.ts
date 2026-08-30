// Grades subjective planning-agent output quality with an optional OpenAI-compatible LLM judge.
import { z } from 'zod';
import { planningJudgeGradeSchema, type PlanningEvalCase, type PlanningEvalTrace, type PlanningJudgeGrade } from './types';

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

function readJudgeEnv(name: string, required: boolean) {
  const value = process.env[name]?.trim();
  if (!value && required) throw new Error(`${name} is required when running planning eval judge`);
  return value;
}

function buildJudgePrompt(evalCase: PlanningEvalCase, trace: PlanningEvalTrace) {
  return [
    'You are grading an Axxon planning-agent eval trace.',
    'Return only strict JSON matching this shape: {"passed":boolean,"overallScore":1-5,"dimensionScores":{"specificity":1-5,"decisionCompleteness":1-5,"clarificationUsefulness":1-5,"architectureCompliance":1-5,"implementationReadiness":1-5,"riskCoverage":1-5,"testability":1-5},"issueCodes":["string"],"evidence":["string"],"suggestedFixArea":"string|null"}.',
    'Score harshly when the agent is generic, misses Axxon org-first architecture, asks useless clarification questions, invents unsupported facts, or leaves an implementer with decisions to make.',
    JSON.stringify({
      case: {
        id: evalCase.id,
        category: evalCase.category,
        prompt: evalCase.prompt,
        expected: evalCase.expected,
      },
      trace: {
        finalState: trace.finalState,
        finalDecisionAction: trace.finalDecisionAction,
        questions: trace.questions,
        quality: trace.quality,
        planArtifact: trace.planArtifact,
        failureMessage: trace.failureMessage,
      },
    }, null, 2),
  ].join('\n\n');
}

function buildMockJudgeGrade(trace: PlanningEvalTrace): PlanningJudgeGrade {
  const qualityScore = trace.quality?.score ?? (trace.failureMessage ? 30 : 75);
  const normalizedScore = Math.max(1, Math.min(5, Math.round(qualityScore / 20)));

  return {
    passed: normalizedScore >= 4 && !trace.failureMessage,
    overallScore: normalizedScore,
    dimensionScores: {
      specificity: normalizedScore,
      decisionCompleteness: normalizedScore,
      clarificationUsefulness: trace.finalState === 'awaiting_input' ? 4 : normalizedScore,
      architectureCompliance: normalizedScore,
      implementationReadiness: normalizedScore,
      riskCoverage: normalizedScore,
      testability: normalizedScore,
    },
    issueCodes: trace.failureMessage ? ['eval_runtime_failure'] : [],
    evidence: trace.failureMessage ? [trace.failureMessage] : ['Mock judge derived from deterministic trace quality.'],
    suggestedFixArea: trace.failureMessage ? 'provider_or_runner' : null,
  };
}

// Runs the optional LLM judge or a deterministic mock judge for local tests.
export async function gradePlanningTraceWithJudge(evalCase: PlanningEvalCase, trace: PlanningEvalTrace, requireJudge: boolean): Promise<PlanningJudgeGrade | null> {
  if (process.env.EVAL_JUDGE_MOCK === '1') {
    return buildMockJudgeGrade(trace);
  }

  const apiKey = readJudgeEnv('EVAL_JUDGE_API_KEY', requireJudge);
  const baseUrl = readJudgeEnv('EVAL_JUDGE_BASE_URL', requireJudge);
  const model = readJudgeEnv('EVAL_JUDGE_MODEL', requireJudge);

  if (!apiKey || !baseUrl || !model) return null;

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise planning-agent eval judge. Return strict JSON only.' },
        { role: 'user', content: buildJudgePrompt(evalCase, trace) },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Planning eval judge failed with ${response.status}`);
  const body = await response.json() as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = planningJudgeGradeSchema.safeParse(parseGeneratedJson(content));
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${issuePath}: ${issue.message}`;
  }).join('; ');
  throw new Error(`Planning eval judge returned invalid JSON: ${issues}`);
}
