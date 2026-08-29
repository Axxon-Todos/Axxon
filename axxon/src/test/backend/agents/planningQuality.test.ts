// Verifies prompt-specific planning quality checks and clarification fallback behavior.
import { describe, expect, it } from 'vitest';
import {
  createEmptyPlanningContext,
  createInitialPlanningReadiness,
  applyPromptPlanningDefaults,
  buildFallbackPlanArtifact,
  buildPlanningRunTitle,
  evaluatePlanningReadiness,
  evaluatePlanArtifactQuality,
  extractPlanningAnchors,
  type AgentPlanningTurnAnalysis,
  type AgentPlanArtifact,
  type AgentQuestion,
} from '@/lib/agents/domain';
import { askClarificationQuestions } from '@/lib/agents/toolCalls/askClarificationQuestions';

const fintechPrompt = 'Create a fintech dashboard that tracks all payments reconciliation and ledgers';

// Builds the planning context used by fintech quality tests.
function createFintechPlanningContext() {
  return {
    ...createEmptyPlanningContext(),
    objective: fintechPrompt,
    inScope: ['Payments reconciliation dashboard', 'Ledger variance review'],
    acceptanceCriteria: ['Users can review payment and ledger mismatches from sample records.'],
    knownRequirements: ['Track payments, reconciliation status, and ledger entries.'],
    planningConfidence: 0.9,
  };
}

// Builds a generic model-generated clarification card that should be rejected for concrete prompts.
function createGenericScopeQuestion(): AgentQuestion {
  return {
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
}

// Builds the generic plan shape that previously reached plan review.
function createGenericFintechPlan(): AgentPlanArtifact {
  return {
    summary: 'Develop a comprehensive dashboard for payments tracking.',
    objective: fintechPrompt,
    scope: {
      inScope: ['Focused MVP'],
      outOfScope: [],
    },
    requirements: ['Focused MVP: Ship one core workflow with minimum supporting pieces.'],
    assumptions: [],
    constraints: [],
    affectedAreas: ['frontend', 'backend'],
    technicalDecisions: [{
      area: 'backend',
      choice: 'Build backend services using Node.js and Express with PostgreSQL',
      rationale: 'The dashboard needs backend services and a database.',
      source: 'assumed',
    }],
    implementationPhases: [{
      id: 'planning-phase',
      title: 'Planning Phase',
      summary: 'Define project scope, timeline, and resource allocation.',
      tasks: [{
        id: 'define-objectives',
        title: 'Define Objectives and Goals',
        description: 'Finalize the project objectives and goals based on requirements and constraints.',
        type: 'planning',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Project objectives and goals are clearly defined.'],
      }, {
        id: 'create-project-plan',
        title: 'Create Project Plan',
        description: 'Develop a detailed project plan including timelines, milestones, and resource allocation.',
        type: 'planning',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Project plan is reviewed and approved by stakeholders.'],
      }],
    }, {
      id: 'development-phase',
      title: 'Development Phase',
      summary: 'Implement the dashboard features and backend services.',
      tasks: [{
        id: 'develop-backend',
        title: 'Develop Backend',
        description: 'Build backend services using Node.js and Express, connecting to a PostgreSQL database.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Backend services are developed and tested.'],
      }],
    }],
    risks: ['Stakeholders may request changes.'],
    successCriteria: ['Dashboard passes end-to-end tests.'],
    openQuestions: [],
    notes: [],
  };
}

// Builds a prompt-anchored fintech plan that should pass quality review.
function createSpecificFintechPlan(): AgentPlanArtifact {
  return {
    summary: 'Create a payments reconciliation dashboard that compares payment records with ledger entries and highlights mismatches.',
    objective: fintechPrompt,
    scope: {
      inScope: ['Import payment records', 'Import ledger entries', 'Show reconciliation mismatches'],
      outOfScope: ['Live bank integrations'],
    },
    requirements: [
      'Normalize payment records and ledger entries into a shared reconciliation view.',
      'Display matched, unmatched, and variance payment rows with ledger references.',
    ],
    assumptions: ['Sample payment and ledger data is available for the first release.'],
    constraints: ['Avoid live money movement in the first release.'],
    affectedAreas: ['payments dashboard', 'ledger reconciliation'],
    technicalDecisions: [],
    implementationPhases: [{
      id: 'reconciliation-data-model',
      title: 'Payments reconciliation data model',
      summary: 'Represent payment and ledger records with reconciliation status.',
      tasks: [{
        id: 'model-payment-ledger-records',
        title: 'Model payment and ledger records',
        description: 'Create fields for payment amount, ledger amount, reconciliation status, and variance reason.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Sample payment and ledger records can be classified as matched, unmatched, or variance.'],
      }, {
        id: 'render-reconciliation-dashboard',
        title: 'Render reconciliation dashboard',
        description: 'Show payment totals, ledger totals, and mismatch rows for operator review.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: ['model-payment-ledger-records'],
        acceptanceCriteria: ['Dashboard shows reconciliation status for every sample payment and ledger row.'],
      }],
    }],
    risks: ['Real ledger schemas may require additional mapping fields.'],
    successCriteria: ['A user can identify payment records that do not reconcile with ledger entries.'],
    openQuestions: ['Which ledger export fields are available in production?'],
    notes: [],
  };
}

describe('planning quality evaluation', () => {
  it('extracts prompt anchors for concrete fintech requests', () => {
    const anchors = extractPlanningAnchors({
      prompt: fintechPrompt,
      context: createFintechPlanningContext(),
    });

    expect(anchors).toEqual(expect.arrayContaining(['payment', 'reconciliation', 'ledger', 'fintech']));
  });

  it('rejects generic clarification cards and falls back to prompt-specific questions', () => {
    const readiness = {
      ...createInitialPlanningReadiness(),
      objectiveClear: true,
      scopeBounded: false,
      hasAcceptanceCriteria: false,
      reasonSummary: ['Scope is still materially unbounded.', 'Acceptance criteria are missing.'],
    };

    const result = askClarificationQuestions({
      candidateQuestions: [createGenericScopeQuestion()],
      existingQuestions: [],
      planningContext: createFintechPlanningContext(),
      prompt: fintechPrompt,
      readiness,
    });

    expect(result.discardedQuestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'Question asks for generic MVP scope or success-bar input.' }),
    ]));
    expect(result.questions.map((question) => question.prompt).join(' ')).toMatch(/payment|reconciliation|ledger/);
    expect(result.questions.map((question) => question.prompt).join(' ')).not.toMatch(/first release|plan is successful/);
  });

  it('uses detailed fallback questions instead of generic release and success cards', () => {
    const readiness = {
      ...createInitialPlanningReadiness(),
      objectiveClear: true,
      scopeBounded: false,
      hasAcceptanceCriteria: false,
      blockingUnknowns: ['functionality'],
      unresolvedUnknowns: ['functionality'],
      reasonSummary: ['Scope is still materially unbounded.', 'Acceptance criteria are missing.'],
    };
    const context = {
      ...createFintechPlanningContext(),
      blockingUnknowns: ['functionality'],
      unresolvedUnknowns: ['functionality'],
    };

    const result = askClarificationQuestions({
      candidateQuestions: [],
      existingQuestions: [],
      planningContext: context,
      prompt: 'can we make a fintech dashboard that tracks all payments reconciliation and ledgers',
      readiness,
    });
    const fallbackText = result.questions.map((question) => question.prompt).join(' ');
    const optionText = result.questions.flatMap((question) => question.options.map((option) => option.label)).join(' ');

    expect(fallbackText).not.toContain('functionality');
    expect(fallbackText).not.toMatch(/first release|plan is successful/);
    expect(optionText).not.toMatch(/Core data flow|Sample records pass|Auditable output/);
    expect(fallbackText).toMatch(/payment reconciliation|ledger|fintech/);
  });

  it('summarizes planning run titles before provider analysis', () => {
    expect(buildPlanningRunTitle('can we make a fintech dashboard that tracks all payments reconciliation and ledgers')).toBe(
      'Fintech Dashboard Tracks Payments Reconciliation Ledgers'
    );
    expect(buildPlanningRunTitle('Finalize the planning agent loop')).toBe('Planning Agent Loop');
  });

  it('allows generic readiness gaps to be satisfied by prompt-derived defaults', () => {
    const prompt = 'Create a fintech dashboard that tracks payment reconciliation and ledger exceptions';
    const analysis: AgentPlanningTurnAnalysis = {
      title: null,
      summary: null,
      assistantMessage: null,
      contextPatch: {
        objective: prompt,
        knownRequirements: ['Track payment reconciliation and ledger exceptions.'],
        planningConfidence: 0.82,
      },
      knownRequirements: ['Track payment reconciliation and ledger exceptions.'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [createGenericScopeQuestion()],
      confidence: 0.82,
      decision: { action: 'ask_questions', reason: 'missing_acceptance_criteria' },
    };
    const context = applyPromptPlanningDefaults({
      context: {
        ...createEmptyPlanningContext(),
        objective: prompt,
        knownRequirements: ['Track payment reconciliation and ledger exceptions.'],
        planningConfidence: 0.82,
      },
      prompt,
    });
    const readiness = evaluatePlanningReadiness({
      analysis,
      context,
      answeredQuestionCount: 0,
      prompt,
    });

    expect(context.assumptions.join(' ')).toContain('focused MVP');
    expect(context.acceptanceCriteria.join(' ')).toMatch(/representative .*payment|representative .*ledger/);
    expect(readiness.recommendedNextAction).toBe('complete_planning');
    expect(readiness.reasonSummary).toContain('Generic clarification request was satisfied by prompt-derived planning defaults.');
  });

  it('fails generic phase-template plans before review', () => {
    const quality = evaluatePlanArtifactQuality({
      artifact: createGenericFintechPlan(),
      context: createFintechPlanningContext(),
      prompt: fintechPrompt,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'generic_project_template',
      'generic_acceptance_criteria',
      'unsupported_stack_assumption',
    ]));
  });

  it('passes prompt-anchored plans with concrete acceptance criteria', () => {
    const quality = evaluatePlanArtifactQuality({
      artifact: createSpecificFintechPlan(),
      context: createFintechPlanningContext(),
      prompt: fintechPrompt,
    });

    expect(quality.passed).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(70);
    expect(quality.issues).toEqual([]);
  });

  it('builds a quality-passing fallback plan after generic provider artifacts', () => {
    const prompt = 'can we make a fintech dashboard that tracks all payments reconciliation and ledgers';
    const context = {
      ...createFintechPlanningContext(),
      objective: prompt,
      inScope: ['Operator review for payment reconciliation and ledgers.'],
      outOfScope: ['Live bank integrations'],
      acceptanceCriteria: [
        'Sample payment reconciliation and ledger records prove the dashboard is successful.',
      ],
      knownRequirements: [
        'Track payments reconciliation, ledger entries, and exception status for operator review.',
      ],
      blockingUnknowns: [],
      unresolvedUnknowns: [],
    };
    const artifact = buildFallbackPlanArtifact({ prompt, context });

    expect(artifact).not.toBeNull();
    expect(artifact?.implementationPhases.map((phase) => phase.title).join(' ')).toMatch(/Payment|Ledger|Reconciliation/);
    expect(evaluatePlanArtifactQuality({ artifact: artifact!, context, prompt })).toMatchObject({
      passed: true,
      issues: [],
    });
  });
});
