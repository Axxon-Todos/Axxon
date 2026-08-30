// Defines planning-agent eval dataset, trace, grading, and report contracts.
import { z } from 'zod';
import {
  agentPlanArtifactSchema,
  agentPlanningQualitySchema,
  agentPlanningTurnAnalysisSchema,
  agentQuestionSchema,
} from '../domain/schemas';
import {
  agentRunStates,
  agentPlanningDecisionActions,
  type AgentPlanArtifact,
  type AgentPlanningQuality,
  type AgentPlanningTurnAnalysis,
  type AgentQuestion,
  type AgentRunEventType,
  type AgentRunState,
} from '../domain/contracts';

export const planningEvalTiers = ['smoke', 'golden', 'judge-calibration'] as const;
export const planningEvalProviders = ['fixture', 'ollama', 'cloud'] as const;
export const planningEvalIssueSeverities = ['info', 'warning', 'error'] as const;
export const planningEvalArchitectureRules = [
  'org_first',
  'agent_backend_only',
  'no_github_writes_before_approval',
  'no_legacy_board_routes',
] as const;

export type PlanningEvalTier = (typeof planningEvalTiers)[number];
export type PlanningEvalProviderName = (typeof planningEvalProviders)[number];
export type PlanningEvalIssueSeverity = (typeof planningEvalIssueSeverities)[number];
export type PlanningEvalArchitectureRule = (typeof planningEvalArchitectureRules)[number];

const clarificationAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(80),
  selectedOptionKey: z.string().trim().min(1).max(80),
  note: z.string().trim().max(1200).nullable().optional(),
});

export const planningEvalExpectedSchema = z.object({
  finalState: z.enum(agentRunStates).optional(),
  decisionAction: z.enum(agentPlanningDecisionActions).optional(),
  shouldAskClarification: z.boolean().optional(),
  shouldUseAwaitingMessage: z.boolean().optional(),
  requirePlanArtifact: z.boolean().default(false),
  mustPassQuality: z.boolean().default(true),
  minQualityScore: z.number().min(0).max(100).default(70),
  maxClarificationTurns: z.number().int().min(0).max(5).optional(),
  minQuestionCount: z.number().int().min(0).max(3).optional(),
  maxQuestionCount: z.number().int().min(0).max(3).optional(),
  requiredTerms: z.array(z.string().trim().min(1)).default([]),
  forbiddenTerms: z.array(z.string().trim().min(1)).default([]),
  disallowedQualityIssueCodes: z.array(z.string().trim().min(1)).default([]),
  architectureRules: z.array(z.enum(planningEvalArchitectureRules)).default([]),
  minJudgeScore: z.number().min(1).max(5).optional(),
});

export const planningEvalFixtureSchema = z.object({
  analyses: z.array(agentPlanningTurnAnalysisSchema).min(1),
  planArtifacts: z.array(agentPlanArtifactSchema).default([]),
});

export const planningEvalCaseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500).optional(),
  prompt: z.string().trim().min(1).max(12_000),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(12_000),
    metadata: z.record(z.unknown()).nullable().optional(),
  })).default([]),
  clarificationAnswers: z.array(z.array(clarificationAnswerSchema).min(1).max(3)).default([]),
  expected: planningEvalExpectedSchema,
  fixture: planningEvalFixtureSchema.optional(),
  human: z.object({
    overallScore: z.number().min(1).max(5),
    notes: z.string().trim().max(1000).optional(),
  }).optional(),
});

export const planningJudgeGradeSchema = z.object({
  passed: z.boolean(),
  overallScore: z.number().min(1).max(5),
  dimensionScores: z.object({
    specificity: z.number().min(1).max(5),
    decisionCompleteness: z.number().min(1).max(5),
    clarificationUsefulness: z.number().min(1).max(5),
    architectureCompliance: z.number().min(1).max(5),
    implementationReadiness: z.number().min(1).max(5),
    riskCoverage: z.number().min(1).max(5),
    testability: z.number().min(1).max(5),
  }),
  issueCodes: z.array(z.string().trim().min(1).max(80)).default([]),
  evidence: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  suggestedFixArea: z.string().trim().min(1).max(160).nullable().default(null),
});

export type PlanningEvalExpected = z.infer<typeof planningEvalExpectedSchema>;
export type PlanningEvalCase = z.infer<typeof planningEvalCaseSchema>;
export type PlanningEvalFixture = z.infer<typeof planningEvalFixtureSchema>;
export type PlanningJudgeGrade = z.infer<typeof planningJudgeGradeSchema>;

export type PlanningEvalMessage = PlanningEvalCase['messages'][number];

export type PlanningEvalTransition = {
  event: AgentRunEventType;
  fromState: AgentRunState;
  toState: AgentRunState;
};

export type PlanningEvalTrace = {
  caseId: string;
  provider: PlanningEvalProviderName;
  finalState: AgentRunState;
  finalDecisionAction: AgentPlanningTurnAnalysis['decision']['action'] | null;
  transitions: PlanningEvalTransition[];
  messages: PlanningEvalMessage[];
  analyses: AgentPlanningTurnAnalysis[];
  questions: AgentQuestion[];
  quality: AgentPlanningQuality | null;
  planArtifact: AgentPlanArtifact | null;
  retryCount: number;
  fallbackUsed: boolean;
  failureMessage: string | null;
  startedAt: string;
  completedAt: string;
};

export type PlanningEvalIssue = {
  code: string;
  severity: PlanningEvalIssueSeverity;
  message: string;
  evidence: string[];
};

export type PlanningEvalGrade = {
  caseId: string;
  passed: boolean;
  deterministicScore: number;
  issues: PlanningEvalIssue[];
  judge: PlanningJudgeGrade | null;
};

export type PlanningEvalCaseResult = {
  case: PlanningEvalCase;
  trace: PlanningEvalTrace;
  grade: PlanningEvalGrade;
};

export type PlanningEvalReport = {
  tier: PlanningEvalTier;
  provider: PlanningEvalProviderName;
  generatedAt: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  deterministicAverage: number;
  judgeAverage: number | null;
  calibrationAgreementRate: number | null;
  baselineLossRate: number | null;
  results: PlanningEvalCaseResult[];
};

export type PlanningEvalBaselineCase = {
  caseId: string;
  passed: boolean;
  deterministicScore: number;
  judgeOverallScore?: number;
  artifactHash?: string;
};

export type PlanningEvalBaseline = {
  generatedAt: string;
  provider: PlanningEvalProviderName;
  cases: PlanningEvalBaselineCase[];
};
