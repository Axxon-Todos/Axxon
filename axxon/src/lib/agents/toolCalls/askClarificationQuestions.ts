// Implements the planning tool that turns candidate gaps into structured clarification cards.
import { z } from 'zod';
import { buildFallbackClarificationQuestions, selectClarificationQuestions } from '../domain/planning';
import { agentPlanningContextSchema, agentPlanningReadinessSchema, agentQuestionSchema } from '../domain/schemas';
import type { AgentPlanningContext, AgentPlanningReadiness, AgentQuestion } from '../domain';

export const askClarificationQuestionsInputSchema = z.object({
  candidateQuestions: z.array(agentQuestionSchema).max(3),
  existingQuestions: z.array(agentQuestionSchema),
  planningContext: agentPlanningContextSchema.nullable().optional(),
  prompt: z.string().trim().max(12_000).optional(),
  readiness: agentPlanningReadinessSchema,
});

export const askClarificationQuestionsResultSchema = z.object({
  discardedQuestions: z.array(z.object({
    questionKey: z.string(),
    prompt: z.string(),
    reason: z.string(),
  })),
  questions: z.array(agentQuestionSchema).max(3),
});

export type AskClarificationQuestionsInput = {
  candidateQuestions: AgentQuestion[];
  existingQuestions: AgentQuestion[];
  planningContext?: AgentPlanningContext | null;
  prompt?: string;
  readiness: AgentPlanningReadiness;
};

// Selects validated model questions and falls back to deterministic cards when necessary.
export function askClarificationQuestions(input: AskClarificationQuestionsInput) {
  const parsedInput = askClarificationQuestionsInputSchema.parse(input);
  const selection = selectClarificationQuestions({
    candidateQuestions: parsedInput.candidateQuestions,
    existingQuestions: parsedInput.existingQuestions,
    planningContext: parsedInput.planningContext,
    prompt: parsedInput.prompt,
  });
  const fallbackSelection = selection.selectedQuestions.length > 0
    ? selection
    : selectClarificationQuestions({
        candidateQuestions: buildFallbackClarificationQuestions(
          parsedInput.readiness,
          parsedInput.planningContext,
          parsedInput.prompt
        ),
        existingQuestions: parsedInput.existingQuestions,
        planningContext: parsedInput.planningContext,
        prompt: parsedInput.prompt,
      });

  return askClarificationQuestionsResultSchema.parse({
    discardedQuestions: [
      ...selection.discardedQuestions,
      ...(selection.selectedQuestions.length > 0 ? [] : fallbackSelection.discardedQuestions),
    ],
    questions: fallbackSelection.selectedQuestions,
  });
}
