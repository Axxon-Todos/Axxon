// Implements the planning tool that turns candidate gaps into structured clarification cards.
import { z } from 'zod';
import { buildFallbackClarificationQuestions, selectClarificationQuestions } from '../domain/planning';
import { agentPlanningReadinessSchema, agentQuestionSchema } from '../domain/schemas';
import type { AgentPlanningReadiness, AgentQuestion } from '../domain';

export const askClarificationQuestionsInputSchema = z.object({
  candidateQuestions: z.array(agentQuestionSchema).max(3),
  existingQuestions: z.array(agentQuestionSchema),
  readiness: agentPlanningReadinessSchema,
});

export const askClarificationQuestionsResultSchema = z.object({
  discardedQuestions: z.array(z.object({
    questionKey: z.string(),
    prompt: z.string(),
    reason: z.string(),
  })),
  questions: z.array(agentQuestionSchema).min(1).max(3),
});

export type AskClarificationQuestionsInput = {
  candidateQuestions: AgentQuestion[];
  existingQuestions: AgentQuestion[];
  readiness: AgentPlanningReadiness;
};

// Selects validated model questions and falls back to deterministic cards when necessary.
export function askClarificationQuestions(input: AskClarificationQuestionsInput) {
  const parsedInput = askClarificationQuestionsInputSchema.parse(input);
  const selection = selectClarificationQuestions({
    candidateQuestions: parsedInput.candidateQuestions,
    existingQuestions: parsedInput.existingQuestions,
  });
  const fallbackSelection = selection.selectedQuestions.length > 0
    ? selection
    : selectClarificationQuestions({
        candidateQuestions: buildFallbackClarificationQuestions(parsedInput.readiness),
        existingQuestions: parsedInput.existingQuestions,
      });

  return askClarificationQuestionsResultSchema.parse({
    discardedQuestions: [
      ...selection.discardedQuestions,
      ...(selection.selectedQuestions.length > 0 ? [] : fallbackSelection.discardedQuestions),
    ],
    questions: fallbackSelection.selectedQuestions.length > 0
      ? fallbackSelection.selectedQuestions
      : buildFallbackClarificationQuestions(parsedInput.readiness),
  });
}
