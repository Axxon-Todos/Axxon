// Verifies recoverable local-model planning JSON mistakes are normalized before strict validation.
import { describe, expect, it } from 'vitest';
import { agentPlanningTurnAnalysisSchema } from '@/lib/agents/domain';
import { normalizeProviderPlanningTurnAnalysis } from '@/lib/agents/providers/planningOutputNormalizer';

// Runs provider normalization through the strict planning-analysis schema.
function parseNormalizedAnalysis(value: unknown) {
  return agentPlanningTurnAnalysisSchema.parse(normalizeProviderPlanningTurnAnalysis(value).value);
}

describe('planning output normalizer', () => {
  it('normalizes copied decision reason enum unions into one valid reason', () => {
    const parsed = parseNormalizedAnalysis({
      contextPatch: {
        objective: null,
      },
      decision: {
        action: 'ask_questions',
        reason: 'missing_objective|scope_unbounded|blocking_unknowns|low_confidence',
      },
    });

    expect(parsed.decision).toEqual({
      action: 'ask_questions',
      reason: 'missing_objective',
    });
  });

  it('normalizes copied decision action enum unions to conservative clarification', () => {
    const parsed = parseNormalizedAnalysis({
      decision: {
        action: 'respond|ask_questions|complete_planning',
        reason: 'missing_objective|scope_unbounded|missing_acceptance_criteria|blocking_unknowns|low_confidence|requirements_satisfied',
      },
    });

    expect(parsed.decision).toEqual({
      action: 'ask_questions',
      reason: 'missing_objective',
    });
  });

  it('drops unusable candidate cards and empty technical decision placeholders', () => {
    const normalized = normalizeProviderPlanningTurnAnalysis({
      contextPatch: {
        technicalDecisions: [{
          area: null,
          choice: null,
          rationale: null,
          source: null,
        }],
      },
      candidateQuestions: [{
        questionKey: 'scope-choice',
        category: 'scope|technical|constraints|dependencies|acceptance_criteria|priority|ux|rollout',
        prompt: 'Which scope should this cover?',
        whyThisMatters: 'The plan needs a bounded scope.',
        required: true,
        blocking: true,
        options: [
          { optionKey: 'small', label: 'Small', description: 'Keep the change focused.', isRecommended: true },
          { optionKey: 'medium', label: 'Medium', description: 'Include adjacent workflow updates.' },
          { optionKey: 'large', label: 'Large', description: 'Update the whole feature area.' },
        ],
      }, {
        questionKey: 'missing-fields',
        category: 'scope',
        options: [
          {},
          {},
          {},
        ],
      }],
      decision: { action: 'ask_questions', reason: 'scope_unbounded' },
    });
    const parsed = agentPlanningTurnAnalysisSchema.parse(normalized.value);

    expect(parsed.contextPatch.technicalDecisions).toEqual([]);
    expect(parsed.candidateQuestions).toEqual([]);
    expect(normalized.diagnostics).toEqual(expect.arrayContaining([
      'Dropped empty technical decision placeholder.',
      'Dropped candidate question with copied category enum union.',
      'Dropped incomplete candidate question.',
    ]));
  });

  it('normalizes copied technical decision source unions to assumed', () => {
    const parsed = parseNormalizedAnalysis({
      contextPatch: {
        technicalDecisions: [{
          area: 'provider parsing',
          choice: 'normalize before strict validation',
          rationale: 'Local models may copy prompt placeholders.',
          source: 'explicit|clarified|assumed',
        }],
      },
      decision: { action: 'ask_questions', reason: 'low_confidence' },
    });

    expect(parsed.contextPatch.technicalDecisions).toEqual([{
      area: 'provider parsing',
      choice: 'normalize before strict validation',
      rationale: 'Local models may copy prompt placeholders.',
      source: 'assumed',
    }]);
  });
});
