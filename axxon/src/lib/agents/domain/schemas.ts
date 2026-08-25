// Provides Zod schemas for agent commands, planning state, tool calls, and provider artifacts.
import { z } from 'zod';
import type { AgentPlanningTurnAnalysis } from './contracts';

export const agentRunTypeSchema = z.enum(['planning', 'coding', 'planning_execution']);

export const createAgentRunCommandSchema = z.object({
  prompt: z.string().trim().min(1).max(12_000),
  runType: agentRunTypeSchema.default('planning'),
});

export const agentQuestionCategorySchema = z.enum([
  'scope',
  'technical',
  'constraints',
  'dependencies',
  'acceptance_criteria',
  'priority',
  'ux',
  'rollout',
]);

export const agentQuestionOptionSchema = z.object({
  optionKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  isRecommended: z.boolean().optional(),
});

export const agentQuestionSchema = z.object({
  questionKey: z.string().trim().min(1).max(80),
  category: agentQuestionCategorySchema,
  prompt: z.string().trim().min(1).max(320),
  whyThisMatters: z.string().trim().min(1).max(260),
  required: z.boolean(),
  blocking: z.boolean(),
  options: z.array(agentQuestionOptionSchema).min(3).max(4),
});

export const submitAgentInputCommandSchema = z.object({
  answers: z
    .array(
      z.object({
        questionKey: z.string().trim().min(1).max(80),
        selectedOptionKey: z.string().trim().min(1).max(80),
        note: z.string().trim().max(1200).nullable().optional(),
      })
    )
    .min(1)
    .max(3),
});

export const submitAgentMessageCommandSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
});

export const requestAgentChangesCommandSchema = z.object({
  feedback: z.string().trim().min(1).max(12_000),
});

export const agentTechnicalDecisionSchema = z.object({
  area: z.string().trim().min(1).max(120),
  choice: z.string().trim().min(1).max(240),
  rationale: z.string().trim().min(1).max(320),
  source: z.enum(['explicit', 'clarified', 'assumed']),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function removeEmptyTechnicalDecisionPlaceholders(value: unknown) {
  if (!Array.isArray(value)) return value;

  return value.filter((entry) => {
    if (!isRecord(entry)) return true;
    return !['area', 'choice', 'rationale', 'source'].every((key) => entry[key] == null);
  });
}

function removeCategoryUnionPlaceholderQuestions(value: unknown) {
  if (!Array.isArray(value)) return value;

  return value.filter((entry) => {
    if (!isRecord(entry)) return true;
    return entry.category !== 'scope|technical|constraints|dependencies|acceptance_criteria|priority|ux|rollout';
  });
}

export const agentPlanningContextSchema = z.object({
  objective: z.string().trim().min(1).max(500).nullable(),
  summary: z.string().trim().min(1).max(1000).nullable(),
  targetOutcome: z.string().trim().min(1).max(1000).nullable(),
  inScope: z.array(z.string().trim().min(1).max(240)).max(25),
  outOfScope: z.array(z.string().trim().min(1).max(240)).max(25),
  assumptions: z.array(z.string().trim().min(1).max(240)).max(25),
  constraints: z.array(z.string().trim().min(1).max(240)).max(25),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(240)).max(25),
  knownRequirements: z.array(z.string().trim().min(1).max(240)).max(30),
  unresolvedUnknowns: z.array(z.string().trim().min(1).max(240)).max(30),
  blockingUnknowns: z.array(z.string().trim().min(1).max(240)).max(30),
  affectedAreas: z.array(z.string().trim().min(1).max(120)).max(25),
  risks: z.array(z.string().trim().min(1).max(240)).max(25),
  dependencies: z.array(z.string().trim().min(1).max(240)).max(25),
  technicalDecisions: z.array(agentTechnicalDecisionSchema).max(15),
  estimatedComplexity: z.enum(['low', 'medium', 'high', 'very_high']).nullable(),
  planningConfidence: z.number().min(0).max(1),
});

const agentPlanningAnalysisContextPatchSchema = agentPlanningContextSchema.extend({
  technicalDecisions: z.preprocess(
    removeEmptyTechnicalDecisionPlaceholders,
    z.array(agentTechnicalDecisionSchema).max(15)
  ),
}).partial();

export const agentPlanningReadinessSchema = z.object({
  objectiveClear: z.boolean(),
  scopeBounded: z.boolean(),
  hasAcceptanceCriteria: z.boolean(),
  knownRequirements: z.array(z.string().trim().min(1).max(240)).max(30),
  unresolvedUnknowns: z.array(z.string().trim().min(1).max(240)).max(30),
  blockingUnknowns: z.array(z.string().trim().min(1).max(240)).max(30),
  confidence: z.number().min(0).max(1),
  recommendedNextAction: z.enum(['ask_questions', 'complete_planning']),
  reasonSummary: z.array(z.string().trim().min(1).max(240)).max(12),
});

export const agentPlanningDecisionSchema = z.object({
  action: z.enum(['ask_questions', 'complete_planning', 'respond']),
  reason: z.enum([
    'missing_objective',
    'scope_unbounded',
    'missing_acceptance_criteria',
    'blocking_unknowns',
    'low_confidence',
    'requirements_satisfied',
  ]),
});

export const agentPlanningTurnAnalysisSchema: z.ZodType<AgentPlanningTurnAnalysis, z.ZodTypeDef, unknown> = z.object({
  title: z.string().trim().min(1).max(120).nullable().default(null),
  summary: z.string().trim().min(1).max(220).nullable().default(null),
  assistantMessage: z.string().trim().min(1).max(1200).nullable().default(null),
  contextPatch: agentPlanningAnalysisContextPatchSchema.default({}),
  knownRequirements: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  unresolvedUnknowns: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  blockingUnknowns: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  resolvedQuestionKeys: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  candidateQuestions: z.preprocess(
    removeCategoryUnionPlaceholderQuestions,
    z.array(agentQuestionSchema.extend({
      options: z.array(agentQuestionOptionSchema).length(3),
    })).max(3).default([])
  ),
  confidence: z.number().min(0).max(1).default(0),
  decision: agentPlanningDecisionSchema,
}).superRefine((analysis, context) => {
  if (analysis.decision.action === 'respond' && !analysis.assistantMessage?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assistantMessage is required when decision.action is respond',
      path: ['assistantMessage'],
    });
  }
});

export const agentPlanArtifactSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  objective: z.string().trim().min(1).max(1200),
  scope: z.object({
    inScope: z.array(z.string().trim().min(1).max(240)).max(25),
    outOfScope: z.array(z.string().trim().min(1).max(240)).max(25),
  }),
  requirements: z.array(z.string().trim().min(1).max(240)).max(30),
  assumptions: z.array(z.string().trim().min(1).max(240)).max(25),
  constraints: z.array(z.string().trim().min(1).max(240)).max(25),
  affectedAreas: z.array(z.string().trim().min(1).max(120)).max(25),
  technicalDecisions: z.array(agentTechnicalDecisionSchema).max(15),
  implementationPhases: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().min(1).max(500),
        tasks: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              title: z.string().trim().min(1).max(200),
              description: z.string().trim().min(1).max(600),
              type: z.string().trim().min(1).max(80),
              priority: z.enum(['low', 'medium', 'high']),
              dependencyIds: z.array(z.string().trim().min(1).max(80)).max(10),
              acceptanceCriteria: z.array(z.string().trim().min(1).max(240)).max(10),
            })
          )
          .min(1)
          .max(12),
      })
    )
    .min(1)
    .max(8),
  risks: z.array(z.string().trim().min(1).max(240)).max(25),
  successCriteria: z.array(z.string().trim().min(1).max(240)).max(25),
  openQuestions: z.array(z.string().trim().min(1).max(240)).max(20),
  notes: z.array(z.string().trim().min(1).max(240)).max(20),
});
