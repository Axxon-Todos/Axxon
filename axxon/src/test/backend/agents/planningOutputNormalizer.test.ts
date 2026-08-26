// Verifies recoverable local-model planning JSON mistakes are normalized before strict validation.
import { describe, expect, it } from 'vitest';
import { agentPlanArtifactSchema, agentPlanningTurnAnalysisSchema } from '@/lib/agents/domain';
import {
  normalizeProviderPlanArtifact,
  normalizeProviderPlanningTurnAnalysis,
} from '@/lib/agents/providers/planningOutputNormalizer';

// Runs provider normalization through the strict planning-analysis schema.
function parseNormalizedAnalysis(value: unknown) {
  return agentPlanningTurnAnalysisSchema.parse(normalizeProviderPlanningTurnAnalysis(value).value);
}

// Runs provider normalization through the strict final-plan artifact schema.
function parseNormalizedArtifact(value: unknown) {
  return agentPlanArtifactSchema.parse(normalizeProviderPlanArtifact(value).value);
}

// Creates a complete artifact fixture so individual malformed fields can be tested in isolation.
function createArtifact(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'Plan payment reconciliation ledger exception handling.',
    objective: 'Build the payment reconciliation ledger exception workflow.',
    scope: {
      inScope: ['Payment reconciliation exceptions'],
      outOfScope: [],
    },
    requirements: ['Operators can review ledger mismatches.'],
    assumptions: ['Existing ledger data is available.'],
    constraints: ['Keep org-scoped agent APIs.'],
    affectedAreas: ['agent backend'],
    technicalDecisions: [],
    implementationPhases: [{
      id: 'ledger-exceptions',
      title: 'Ledger exceptions',
      summary: 'Implement payment reconciliation exception review.',
      tasks: [{
        id: 'exception-review',
        title: 'Exception review',
        description: 'Add tasks for operator review of ledger mismatches.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Operators can identify ledger mismatches.'],
      }],
    }],
    risks: [],
    successCriteria: ['Ledger exception review is traceable.'],
    openQuestions: [],
    notes: [],
    ...overrides,
  };
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

  it('normalizes object assumptions into strings for final artifacts', () => {
    const parsed = parseNormalizedArtifact(createArtifact({
      assumptions: [
        { text: 'Existing payment ledger records are available.' },
        { description: 'Operators already have permission to review exceptions.' },
      ],
    }));

    expect(parsed.assumptions).toEqual([
      'Existing payment ledger records are available.',
      'Operators already have permission to review exceptions.',
    ]);
  });

  it('normalizes object acceptance criteria into strings for final artifact tasks', () => {
    const parsed = parseNormalizedArtifact(createArtifact({
      implementationPhases: [{
        id: 'ledger-exceptions',
        title: 'Ledger exceptions',
        summary: 'Implement payment reconciliation exception review.',
        tasks: [{
          id: 'exception-review',
          title: 'Exception review',
          description: 'Add tasks for operator review of ledger mismatches.',
          type: 'implementation',
          priority: 'high',
          dependencyIds: [],
          acceptanceCriteria: [
            { criterion: 'Operators can filter payment reconciliation exceptions.' },
            { title: 'Ledger mismatches show traceable status.' },
          ],
        }],
      }],
    }));

    expect(parsed.implementationPhases[0]?.tasks[0]?.acceptanceCriteria).toEqual([
      'Operators can filter payment reconciliation exceptions.',
      'Ledger mismatches show traceable status.',
    ]);
  });

  it('drops empty copied final-artifact placeholders', () => {
    const normalized = normalizeProviderPlanArtifact(createArtifact({
      assumptions: [
        { text: null, description: null },
        { text: 'Existing ledger imports remain available.' },
      ],
      implementationPhases: [{
        id: 'ledger-exceptions',
        title: 'Ledger exceptions',
        summary: 'Implement payment reconciliation exception review.',
        tasks: [{
          id: 'exception-review',
          title: 'Exception review',
          description: 'Add tasks for operator review of ledger mismatches.',
          type: 'implementation',
          priority: 'high',
          dependencyIds: [],
          acceptanceCriteria: [
            { criterion: '' },
            { criterion: 'Exception review has a visible ledger audit trail.' },
          ],
        }],
      }],
    }));
    const parsed = agentPlanArtifactSchema.parse(normalized.value);

    expect(parsed.assumptions).toEqual(['Existing ledger imports remain available.']);
    expect(parsed.implementationPhases[0]?.tasks[0]?.acceptanceCriteria).toEqual([
      'Exception review has a visible ledger audit trail.',
    ]);
    expect(normalized.diagnostics).toEqual(expect.arrayContaining([
      'Dropped empty assumptions[0] placeholder.',
      'Dropped empty implementationPhases[0].tasks[0].acceptanceCriteria[0] placeholder.',
    ]));
  });

  it('leaves unrecoverable nested objects invalid after final-artifact normalization', () => {
    const normalized = normalizeProviderPlanArtifact(createArtifact({
      assumptions: [{ nested: { text: 'This should not be flattened.' } }],
    }));

    expect(() => agentPlanArtifactSchema.parse(normalized.value)).toThrow();
  });
});
