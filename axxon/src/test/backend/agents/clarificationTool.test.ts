// Verifies clarification-card selection does not re-ask exhausted fallback questions.
import { describe, expect, it } from 'vitest';
import { createInitialPlanningReadiness, type AgentQuestion } from '@/lib/agents/domain';
import { askClarificationQuestions } from '@/lib/agents/toolCalls/askClarificationQuestions';

const firstReleaseBoundaryQuestion: AgentQuestion = {
  questionKey: 'first-release-boundary',
  category: 'scope',
  prompt: 'What should the first release boundary be?',
  whyThisMatters: 'A tighter first-release boundary keeps the implementation plan realistic and sequenced.',
  required: true,
  blocking: true,
  options: [
    { optionKey: 'focused-mvp', label: 'Focused MVP', description: 'Ship one core workflow with minimum supporting pieces.', isRecommended: true },
    { optionKey: 'balanced-v1', label: 'Balanced V1', description: 'Ship the core workflow plus a few supporting capabilities.' },
    { optionKey: 'broad-platform', label: 'Broad platform', description: 'Build several major capabilities in the first release.' },
    { optionKey: 'none-of-the-above', label: 'None of the above', description: 'The right answer is not listed; add a note if needed.' },
  ],
};

describe('ask clarification questions tool', () => {
  it('returns no cards instead of re-asking duplicate fallback questions', () => {
    const readiness = {
      ...createInitialPlanningReadiness(),
      objectiveClear: true,
      scopeBounded: false,
      hasAcceptanceCriteria: true,
      reasonSummary: ['Scope is still materially unbounded.'],
    };

    const result = askClarificationQuestions({
      candidateQuestions: [],
      existingQuestions: [firstReleaseBoundaryQuestion],
      readiness,
    });

    expect(result.questions).toEqual([]);
    expect(result.discardedQuestions).toEqual([{
      questionKey: 'first-release-boundary',
      prompt: 'What should the first release boundary be?',
      reason: 'Question key already exists.',
    }]);
  });
});
