// Verifies provider-facing planning schemas accept safe defaults without relaxing required decisions.
import { describe, expect, it } from 'vitest';
import { agentPlanningTurnAnalysisSchema } from '@/lib/agents/domain';

describe('agent planning turn analysis schema', () => {
  it('fills safe defaults when the model returns a minimal decision', () => {
    const parsed = agentPlanningTurnAnalysisSchema.parse({
      decision: { action: 'ask_questions', reason: 'low_confidence' },
    });

    expect(parsed).toEqual({
      title: null,
      summary: null,
      assistantMessage: null,
      contextPatch: {},
      knownRequirements: [],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0,
      decision: { action: 'ask_questions', reason: 'low_confidence' },
    });
  });

  it('accepts assistant responses for vague planning prompts', () => {
    const parsed = agentPlanningTurnAnalysisSchema.parse({
      assistantMessage: 'What would you like me to plan?',
      decision: { action: 'respond', reason: 'missing_objective' },
    });

    expect(parsed.assistantMessage).toBe('What would you like me to plan?');
    expect(parsed.decision.action).toBe('respond');
  });

  it('requires an assistant message when the model chooses respond', () => {
    const parsed = agentPlanningTurnAnalysisSchema.safeParse({
      decision: { action: 'respond', reason: 'missing_objective' },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toContain('assistantMessage');
    }
  });

  it('still requires the model planning decision', () => {
    const parsed = agentPlanningTurnAnalysisSchema.safeParse({
      title: 'Missing decision',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toContain('decision');
    }
  });

  it('still rejects malformed candidate questions supplied by the model', () => {
    const parsed = agentPlanningTurnAnalysisSchema.safeParse({
      decision: { action: 'ask_questions', reason: 'missing_acceptance_criteria' },
      candidateQuestions: [{
        questionKey: 'success-bar',
        category: 'acceptance_criteria',
        prompt: 'What should count as success?',
        whyThisMatters: 'The implementation plan needs acceptance criteria.',
        required: true,
        blocking: true,
        options: [
          { optionKey: 'demo', label: 'Demo', description: 'Show the end-to-end flow.', isRecommended: true },
          { optionKey: 'production', label: 'Production', description: 'Make it production ready.' },
        ],
      }],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toContain('candidateQuestions.0.options');
    }
  });
});
