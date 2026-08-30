// Verifies prompt-specific planning quality checks and clarification fallback behavior.
import { describe, expect, it } from 'vitest';
import {
  createEmptyPlanningContext,
  createInitialPlanningReadiness,
  applyClarificationAnswersToContext,
  applyPromptPlanningDefaults,
  buildFallbackPlanArtifact,
  buildPlanningRunTitle,
  evaluatePlanningReadiness,
  evaluatePlanArtifactQuality,
  extractPlanningAnchors,
  findMissingMaterialPlanningSlots,
  type AgentPlanningTurnAnalysis,
  type AgentPlanArtifact,
  type AgentQuestion,
} from '@/lib/agents/domain';
import { askClarificationQuestions } from '@/lib/agents/toolCalls/askClarificationQuestions';

const fintechPrompt = 'Create a fintech dashboard that tracks all payments reconciliation and ledgers';
const monitoringPrompt = 'i want to make a dashboard built with rust and nextjs to monitor my agents performance in realtime with heavy visual graphs showing realtime evals and tool calls in orders alongside many other crucial monitoring requirements';

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

// Builds the monitoring context produced after all material monitoring choices are clarified.
function createMonitoringPlanningContext() {
  return {
    ...createEmptyPlanningContext(),
    objective: monitoringPrompt,
    inScope: ['Realtime agent performance dashboard for eval results, tool calls, run traces, latency, cost, and failures.'],
    outOfScope: ['Autonomous remediation from dashboard alerts.'],
    acceptanceCriteria: [
      'The Next.js dashboard renders ordered realtime eval and tool-call records from the WebSocket stream.',
      'Telemetry reloads use 24h raw events and 90d rollups from the app event store.',
    ],
    knownRequirements: [
      'Rust emits agent telemetry through an OpenTelemetry collector.',
      'A WebSocket stream pushes realtime monitoring updates to the Next.js dashboard.',
      'Recharts renders eval, tool-call, trace, latency, cost, and failure graphs.',
      'The app event store persists raw telemetry and rollup tables.',
      'Keep 24h raw events and 90d graph rollups.',
    ],
    technicalDecisions: [{
      area: 'telemetry exporter',
      choice: 'OpenTelemetry collector',
      rationale: 'Emit spans, metrics, and events from Rust into an OTEL collector.',
      source: 'clarified' as const,
    }, {
      area: 'realtime transport',
      choice: 'WebSocket stream',
      rationale: 'Push live run, eval, and tool-call updates over a bidirectional socket.',
      source: 'clarified' as const,
    }, {
      area: 'graphing stack',
      choice: 'Recharts',
      rationale: 'Use the existing React charting dependency already present in the app.',
      source: 'clarified' as const,
    }, {
      area: 'monitoring storage',
      choice: 'App event store with rollup tables',
      rationale: 'Persist raw telemetry in the application event store and aggregate graph data into rollup tables.',
      source: 'clarified' as const,
    }, {
      area: 'retention window',
      choice: '24h raw events and 90d rollups',
      rationale: 'Bound first-release storage and cleanup behavior.',
      source: 'clarified' as const,
    }],
    planningConfidence: 0.92,
  };
}

// Builds a model artifact matching the monitoring plan failure reported by the user.
function createUnderspecifiedMonitoringPlan(): AgentPlanArtifact {
  return {
    summary: 'A dashboard built with Rust and NextJS to monitor agents performance in real-time, showing heavy visual graphs of realtime evals and tool calls.',
    objective: 'Build a dashboard to monitor agents performance in real-time using Rust and NextJS',
    implementationDetails: {
      dataFlow: [
        'Rust agent runtime emits telemetry data via OpenTelemetry collector.',
        'OpenTelemetry collector buffers data and forwards it to an intermediary storage layer.',
        'Next.js frontend subscribes to a WebSocket stream for real-time updates.',
      ],
      tooling: [
        'Rust compiler and standard library for agent runtime logic.',
        'NextJS framework for dashboard components.',
        'OpenTelemetry collector for data collection and forwarding.',
        'WebSocket library for bi-directional communication.',
      ],
      integrations: [
        'Integrate Rust OpenTelemetry exporter with an intermediary storage system like Prometheus or InfluxDB.',
        'Next.js frontend subscribes to a WebSocket server that will proxy the real-time data stream from the collector.',
      ],
      realtimeStrategy: ['Use WebSocket for near-instant bi-directional communication between agent and dashboard.'],
      storageAndRetention: ['Set retention policies based on business needs.'],
      observability: ['Monitor WebSocket connections and performance metrics using Next.js built-in tools or external services.'],
      securityAndAccess: ['Implement authentication/authorization for dashboard access.'],
    },
    scope: {
      inScope: ['Real-time visual graphs of evals and tool calls.'],
      outOfScope: ['Advanced features not explicitly mentioned in the initial prompt are out of scope.'],
    },
    requirements: [
      'Rust agent telemetry to be emitted via OpenTelemetry collector.',
      'Real-time updates on the Next.js dashboard using WebSocket stream.',
      'Visual graphs showing evals and tool calls.',
      'Support for multiple monitoring records including latency, cost, failures.',
    ],
    assumptions: ['Use a focused MVP boundary based on prompt requirements.'],
    constraints: [],
    affectedAreas: ['Rust agent runtime', 'Next.js dashboard'],
    technicalDecisions: [{
      area: 'graphing stack',
      choice: 'Recharts',
      rationale: 'Use the existing React charting dependency already present in the app.',
      source: 'clarified',
    }],
    implementationPhases: [{
      id: 'setup-development-environment',
      title: 'Setup Development Environment',
      summary: 'Setting up Rust, Next.js, and OpenTelemetry collector development environments.',
      tasks: [{
        id: 'install-rust',
        title: 'Install Rust and necessary dependencies',
        description: 'Install Rust and required libraries for agent runtime logic.',
        type: 'setup',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Rust compiler and dependencies are installed on the development machine.'],
      }, {
        id: 'set-up-next-js-project',
        title: 'Set up Next.js project',
        description: 'Create a new Next.js project with the necessary dependencies for dashboard components.',
        type: 'setup',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Next.js project is created with all required components and dependencies.'],
      }],
    }, {
      id: 'develop-frontend-components',
      title: 'Develop Frontend Components',
      summary: 'Creating React components to visualize agent performance data.',
      tasks: [{
        id: 'build-dashboard-layout',
        title: 'Build dashboard layout',
        description: 'Design and implement the overall layout for the monitoring dashboard.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Dashboard layout is designed and implemented.'],
      }, {
        id: 'create-visualization-components',
        title: 'Create visualization components',
        description: 'Develop components for visualizing evals, tool calls, latency, cost, and failures.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Visual components for all required monitoring records are created.'],
      }, {
        id: 'deploy-application',
        title: 'Deploy application',
        description: 'Deploy the Next.js frontend and Rust agent runtime to a production environment.',
        type: 'deployment',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Application is successfully deployed.'],
      }],
    }],
    risks: ['Risk of data loss due to collector buffer overflow or backend failure.'],
    successCriteria: ['Successful deployment and stable operation in a production environment.'],
    openQuestions: [
      'What are the specific requirements for data retention policies?',
      'Are there any compliance or security regulations that need to be considered?',
    ],
    notes: ['Ensure all code is well-documented and tested thoroughly.'],
  };
}

// Builds a monitoring artifact with resolved material decisions and measurable verification.
function createDecisionCompleteMonitoringPlan(): AgentPlanArtifact {
  return {
    summary: 'Build a Rust and Next.js realtime agent performance dashboard backed by OpenTelemetry, app event storage, WebSocket updates, and Recharts views.',
    objective: monitoringPrompt,
    implementationDetails: {
      dataFlow: [
        'Rust agent runtime emits eval results, tool calls, run traces, latency, cost, and failures through OpenTelemetry spans, metrics, and events.',
        'The OpenTelemetry collector forwards telemetry into the app event store and rollup tables.',
        'A backend WebSocket service reads stored telemetry and rollup updates before streaming ordered dashboard events.',
        'The Next.js dashboard renders Recharts views from WebSocket updates and reload backfill API reads.',
      ],
      tooling: ['Rust OpenTelemetry SDK', 'OpenTelemetry collector', 'Next.js', 'WebSocket service', 'Recharts'],
      integrations: ['Integrate Rust telemetry emission with the OpenTelemetry collector and app event store.'],
      realtimeStrategy: ['Stream ordered eval, tool-call, trace, latency, cost, and failure events over WebSocket with reconnect backfill.'],
      storageAndRetention: ['Persist raw telemetry in the app event store for 24h and aggregate graph rollups for 90d.'],
      observability: ['Track collector ingestion lag, WebSocket fanout lag, dropped event count, and dashboard render delay.'],
      securityAndAccess: ['Require authenticated dashboard access and enforce organization-scoped telemetry reads.'],
    },
    scope: {
      inScope: ['Realtime agent performance graphs', 'Eval result and tool-call ordering', 'Run trace, latency, cost, and failure monitoring'],
      outOfScope: ['Automated incident remediation'],
    },
    requirements: [
      'Rust must emit first-class telemetry for eval results, tool calls, run traces, latency, cost, and failures.',
      'The OpenTelemetry collector must forward records into app event storage and 90d rollup tables.',
      'The WebSocket service must stream ordered realtime agent events to the Next.js dashboard.',
      'The Next.js dashboard must use Recharts for eval, tool-call, trace, latency, cost, and failure graph panels.',
      'Reloaded dashboard sessions must backfill from 24h raw events and 90d rollups.',
    ],
    assumptions: ['The app event store and rollup tables are the first-release monitoring history backend.'],
    constraints: ['Keep telemetry reads scoped to authenticated organization members.'],
    affectedAreas: ['Rust agent runtime', 'OpenTelemetry collector pipeline', 'backend WebSocket service', 'Next.js monitoring dashboard'],
    technicalDecisions: createMonitoringPlanningContext().technicalDecisions,
    implementationPhases: [{
      id: 'telemetry-contract',
      title: 'Agent telemetry contract',
      summary: 'Define records and ordering keys for realtime eval, tool-call, trace, latency, cost, and failure monitoring.',
      tasks: [{
        id: 'define-agent-telemetry-records',
        title: 'Define agent telemetry records',
        description: 'Create schemas for eval results, tool calls, run traces, latency, cost, failures, run id, sequence number, and timestamp.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: [],
        acceptanceCriteria: ['Every eval, tool call, trace, latency, cost, and failure record includes run id, sequence number, and timestamp.'],
      }],
    }, {
      id: 'rust-otel-ingestion',
      title: 'Rust OpenTelemetry ingestion',
      summary: 'Emit Rust agent telemetry through OTEL and persist it for dashboard reads.',
      tasks: [{
        id: 'emit-rust-agent-telemetry',
        title: 'Emit Rust agent telemetry',
        description: 'Instrument the Rust agent runtime to emit OpenTelemetry spans, metrics, and events for evals, tool calls, traces, latency, cost, and failures.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: ['define-agent-telemetry-records'],
        acceptanceCriteria: ['A sample Rust run produces OTEL records for evals, tool calls, traces, latency, cost, and failures.'],
      }, {
        id: 'persist-telemetry-rollups',
        title: 'Persist telemetry rollups',
        description: 'Forward collector output into the app event store, keep 24h raw events, and write 90d rollup buckets for Recharts queries.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: ['emit-rust-agent-telemetry'],
        acceptanceCriteria: ['Raw agent events expire after 24h while eval, tool-call, latency, cost, and failure rollups remain queryable for 90d.'],
      }],
    }, {
      id: 'dashboard-streaming',
      title: 'Next.js realtime dashboard',
      summary: 'Stream ordered telemetry into Recharts panels with reload backfill.',
      tasks: [{
        id: 'stream-agent-monitoring-events',
        title: 'Stream agent monitoring events',
        description: 'Build a backend WebSocket service that reads app event store updates and sends ordered eval, tool-call, trace, latency, cost, and failure events to Next.js.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: ['persist-telemetry-rollups'],
        acceptanceCriteria: ['The dashboard receives ordered WebSocket events with no duplicate tool calls after reconnect.'],
      }, {
        id: 'render-recharts-monitoring-views',
        title: 'Render Recharts monitoring views',
        description: 'Render realtime eval, tool-call, trace, latency, cost, and failure graph panels in the Next.js dashboard.',
        type: 'implementation',
        priority: 'high',
        dependencyIds: ['stream-agent-monitoring-events'],
        acceptanceCriteria: ['Recharts panels update from WebSocket events and reload from 24h raw history plus 90d rollups.'],
      }],
    }],
    risks: ['High telemetry volume can increase collector lag and WebSocket fanout delay.'],
    successCriteria: [
      'Realtime eval and tool-call updates appear in the Next.js dashboard within a measured p95 live update target.',
      'Reconnect backfill preserves ordered tool-call and eval records without duplicates.',
      '24h raw telemetry and 90d rollups support reloads for eval, trace, latency, cost, and failure graphs.',
    ],
    openQuestions: [],
    notes: ['Compliance-specific retention can be revisited if regulated telemetry is introduced later.'],
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

  it('extracts useful anchors from realtime agent monitoring prompts', () => {
    const anchors = extractPlanningAnchors({ prompt: monitoringPrompt, context: null });

    expect(anchors).toEqual(expect.arrayContaining(['agent performance', 'realtime eval', 'tool call', 'dashboard', 'nextjs']));
    expect(anchors).not.toEqual(expect.arrayContaining(['want built', 'built rust']));
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

  it('requires monitoring implementation slots before completing planning', () => {
    const analysis: AgentPlanningTurnAnalysis = {
      title: null,
      summary: null,
      assistantMessage: null,
      contextPatch: {
        objective: monitoringPrompt,
        knownRequirements: ['Monitor realtime evals and tool calls for agent performance.'],
        planningConfidence: 0.9,
      },
      knownRequirements: ['Monitor realtime evals and tool calls for agent performance.'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      resolvedQuestionKeys: [],
      candidateQuestions: [],
      confidence: 0.9,
      decision: { action: 'complete_planning', reason: 'requirements_satisfied' },
    };
    const context = applyPromptPlanningDefaults({
      context: {
        ...createEmptyPlanningContext(),
        objective: monitoringPrompt,
        knownRequirements: ['Monitor realtime evals and tool calls for agent performance.'],
        planningConfidence: 0.9,
      },
      prompt: monitoringPrompt,
    });
    const readiness = evaluatePlanningReadiness({ analysis, context, answeredQuestionCount: 0, prompt: monitoringPrompt });

    expect(findMissingMaterialPlanningSlots(monitoringPrompt, context)).toEqual(expect.arrayContaining([
      'data source/exporter',
      'realtime transport',
      'visualization tooling',
      'storage backend',
      'retention window',
    ]));
    expect(readiness.recommendedNextAction).toBe('ask_questions');
    expect(readiness.blockingUnknowns.join(' ')).toContain('data source/exporter');
  });

  it('asks monitoring prompts for exporter, realtime, and graphing choices', () => {
    const context = applyPromptPlanningDefaults({
      context: {
        ...createEmptyPlanningContext(),
        objective: monitoringPrompt,
        knownRequirements: ['Monitor realtime evals and tool calls for agent performance.'],
      },
      prompt: monitoringPrompt,
    });
    const result = askClarificationQuestions({
      candidateQuestions: [],
      existingQuestions: [],
      planningContext: context,
      prompt: monitoringPrompt,
      readiness: {
        ...createInitialPlanningReadiness(),
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        blockingUnknowns: findMissingMaterialPlanningSlots(monitoringPrompt, context),
      },
    });
    const questionText = result.questions.map((question) => question.prompt).join(' ');

    expect(questionText).toContain('How should Rust export agent telemetry to the Next.js dashboard?');
    expect(questionText).toContain('Which realtime delivery model should stream agent monitoring updates?');
    expect(questionText).toContain('Which graphing stack should the monitoring dashboard standardize on?');
  });

  it('asks remaining monitoring prompts for telemetry scope, storage backend, and retention window', () => {
    const context = {
      ...createEmptyPlanningContext(),
      objective: monitoringPrompt,
      inScope: ['Realtime agent performance dashboard.'],
      acceptanceCriteria: ['The dashboard renders ordered realtime eval and tool-call records.'],
      knownRequirements: [
        'Rust emits telemetry through an OpenTelemetry collector.',
        'A WebSocket stream pushes updates to the Next.js dashboard.',
        'Recharts renders realtime monitoring graphs.',
      ],
      technicalDecisions: createMonitoringPlanningContext().technicalDecisions.slice(0, 3),
    };
    const result = askClarificationQuestions({
      candidateQuestions: [],
      existingQuestions: [],
      planningContext: context,
      prompt: monitoringPrompt,
      readiness: {
        ...createInitialPlanningReadiness(),
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        blockingUnknowns: findMissingMaterialPlanningSlots(monitoringPrompt, context),
      },
    });
    const questionText = result.questions.map((question) => question.prompt).join(' ');

    expect(questionText).toContain('Which agent telemetry records should be first-class in the plan?');
    expect(questionText).toContain('Where should monitoring history and rollups be stored for the first release?');
    expect(questionText).toContain('What retention window should define the monitoring MVP?');
    expect(result.questions.find((question) => question.questionKey === 'agent-telemetry-scope')?.allowMultiple).toBe(true);
  });

  it('persists multi-select telemetry scope answers into planning memory', () => {
    const question: AgentQuestion = {
      questionKey: 'agent-telemetry-scope',
      category: 'scope',
      prompt: 'Which agent telemetry records should be first-class in the plan?',
      whyThisMatters: 'The implementation plan needs structured telemetry priorities.',
      required: true,
      blocking: true,
      allowMultiple: true,
      options: [
        { optionKey: 'eval-results', label: 'Eval results', description: 'Track eval score and pass/fail state.' },
        { optionKey: 'tool-calls', label: 'Tool calls', description: 'Track tool name, status, latency, and errors.' },
        { optionKey: 'run-traces', label: 'Run traces', description: 'Track ordered agent steps and state transitions.' },
      ],
    };
    const context = applyClarificationAnswersToContext({
      context: createEmptyPlanningContext(),
      questions: [question],
      answers: [{
        questionKey: 'agent-telemetry-scope',
        selectedOptionKeys: ['eval-results', 'tool-calls', 'run-traces'],
      }],
    });

    expect(context.inScope[0]).toContain('Eval results, Tool calls, Run traces');
    expect(context.knownRequirements[0]).toContain('Track tool name, status, latency, and errors.');
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

  it('fails shallow monitoring plans that omit material implementation details', () => {
    const artifact = createGenericFintechPlan();
    artifact.objective = monitoringPrompt;
    artifact.summary = 'Build a Rust and Next.js realtime monitoring dashboard for agent performance.';
    artifact.requirements = [
      'Show realtime agent performance.',
      'Show evals and tool calls.',
      'Use visual graphs.',
    ];
    artifact.technicalDecisions = [{
      area: 'dashboard stack',
      choice: 'Use Rust and Next.js with Chart.js.',
      rationale: 'The prompt names Rust and Next.js and asks for heavy visual graphs.',
      source: 'assumed',
    }];

    const quality = evaluatePlanArtifactQuality({
      artifact,
      context: createEmptyPlanningContext(),
      prompt: monitoringPrompt,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsupported_stack_assumption',
      'missing_implementation_detail_slots',
      'thin_complex_plan',
    ]));
  });

  it('fails monitoring plans that still defer material choices after generation', () => {
    const quality = evaluatePlanArtifactQuality({
      artifact: createUnderspecifiedMonitoringPlan(),
      context: createMonitoringPlanningContext(),
      prompt: monitoringPrompt,
    });

    expect(quality.passed).toBe(false);
    expect(quality.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'generic_project_template',
      'material_open_questions',
      'undecided_material_alternatives',
      'invalid_monitoring_data_flow',
    ]));
  });

  it('passes decision-complete monitoring plans with resolved implementation choices', () => {
    const quality = evaluatePlanArtifactQuality({
      artifact: createDecisionCompleteMonitoringPlan(),
      context: createMonitoringPlanningContext(),
      prompt: monitoringPrompt,
    });

    expect(quality.passed).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(70);
    expect(quality.issues).toEqual([]);
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
