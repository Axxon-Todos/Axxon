// Verifies clarification answers persist into structured planning context memory.
import { describe, expect, it } from 'vitest';
import {
  applyClarificationAnswersToContext,
  agentPlanningContextSchema,
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
      'What should the first release boundary be?: Focused MVP.',
    ]);
    expect(context.acceptanceCriteria).toEqual([
      'What should count as success for the first release?: End-to-end demo.',
    ]);
    expect(context.knownRequirements).toEqual([
      'What should the first release boundary be?: Focused MVP.',
      'Focused MVP: Ship one core workflow with minimum supporting pieces.',
      'What should count as success for the first release?: End-to-end demo.',
      'End-to-end demo: The first release proves the core workflow from input to output.',
    ]);
  });

  it('keeps multi-select telemetry answers inside planning context schema limits', () => {
    const telemetryQuestion: AgentQuestion = {
      questionKey: 'agent-telemetry-scope',
      category: 'scope',
      prompt: 'Which agent telemetry records should be first-class in the plan?',
      whyThisMatters: 'The implementation plan needs structured telemetry priorities instead of a vague monitoring requirement.',
      required: true,
      blocking: true,
      allowMultiple: true,
      options: [
        { optionKey: 'eval-results', label: 'Eval results', description: 'Track eval score, suite, pass/fail state, and model/run metadata.' },
        { optionKey: 'tool-calls', label: 'Tool calls', description: 'Track tool name, arguments summary, result status, latency, and errors.' },
        { optionKey: 'run-traces', label: 'Run traces', description: 'Track ordered agent steps, state transitions, and message timing.' },
        { optionKey: 'latency-cost', label: 'Latency and cost', description: 'Track duration, token usage, queue time, and estimated spend.' },
        { optionKey: 'failures', label: 'Failures', description: 'Track provider errors, tool failures, retries, and unresolved exceptions.' },
      ],
    };
    const context = applyClarificationAnswersToContext({
      context: createEmptyPlanningContext(),
      questions: [telemetryQuestion],
      answers: [{
        questionKey: 'agent-telemetry-scope',
        selectedOptionKeys: ['eval-results', 'tool-calls', 'run-traces', 'latency-cost', 'failures'],
      }],
    });

    expect(() => agentPlanningContextSchema.parse(context)).not.toThrow();
    expect(context.inScope[0]).toBe('Which agent telemetry records should be first-class in the plan?: Eval results, Tool calls, Run traces, Latency and cost, Failures.');
    expect(context.knownRequirements).toEqual(expect.arrayContaining([
      'Tool calls: Track tool name, arguments summary, result status, latency, and errors.',
      'Failures: Track provider errors, tool failures, retries, and unresolved exceptions.',
    ]));
    expect(context.knownRequirements.every((requirement) => requirement.length <= 240)).toBe(true);
  });
});
