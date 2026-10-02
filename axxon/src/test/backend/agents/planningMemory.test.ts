// Verifies clarification answers persist into structured planning context memory.
import { describe, expect, it } from 'vitest';
import {
  applyClarificationAnswersToContext,
  createEmptyPlanningContext,
  type AgentQuestion,
} from '@/lib/agents/domain';

const scopeQuestion: AgentQuestion = {
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
  ],
};

const successQuestion: AgentQuestion = {
  questionKey: 'first-release-success-bar',
  category: 'acceptance_criteria',
  prompt: 'What should count as success for the first release?',
  whyThisMatters: 'The plan needs a clear success bar before it can choose the right amount of build and polish.',
  required: true,
  blocking: true,
  options: [
    { optionKey: 'end-to-end-demo', label: 'End-to-end demo', description: 'The first release proves the core workflow from input to output.', isRecommended: true },
    { optionKey: 'production-ready-slice', label: 'Production slice', description: 'The first release is stable, observable, and ready for real users.' },
    { optionKey: 'exploratory-prototype', label: 'Prototype', description: 'The first release validates concept and UX before hardening.' },
  ],
};

describe('planning clarification memory', () => {
  it('maps scope and success-bar answers into structured planning context', () => {
    const context = applyClarificationAnswersToContext({
      context: createEmptyPlanningContext(),
      questions: [scopeQuestion, successQuestion],
      answers: [
        { questionKey: 'first-release-boundary', selectedOptionKey: 'focused-mvp' },
        { questionKey: 'first-release-success-bar', selectedOptionKey: 'end-to-end-demo' },
      ],
    });

    expect(context.inScope).toEqual([
      'What should the first release boundary be?: Focused MVP. Ship one core workflow with minimum supporting pieces.',
    ]);
    expect(context.acceptanceCriteria).toEqual([
      'What should count as success for the first release?: End-to-end demo. The first release proves the core workflow from input to output.',
    ]);
    expect(context.knownRequirements).toEqual([
      'What should the first release boundary be?: Focused MVP. Ship one core workflow with minimum supporting pieces.',
      'What should count as success for the first release?: End-to-end demo. The first release proves the core workflow from input to output.',
    ]);
  });
});
