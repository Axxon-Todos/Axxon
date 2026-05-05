// Verifies planning analysis tolerates near-schema local-model JSON without failing the session.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedCompleteAiStructuredJson } = vi.hoisted(() => ({
  mockedCompleteAiStructuredJson: vi.fn(),
}));

vi.mock('@/lib/ai/service', () => ({
  completeAiStructuredJson: mockedCompleteAiStructuredJson,
}));

describe('planning analysis schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes loose Ollama analysis output into the required planning shape', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        title: 'Make a rust web server to monitor endpoints and AI models',
        summary:
          'The user wants to create a Rust web server that monitors endpoints on a visual 3D chart and includes an AI model metrics monitor.',
        contextPatch: {
          objective:
            'Create a Rust web server with a 3D visualization of endpoint activity and an AI model metrics monitor.',
          knownRequirements: [],
          unresolvedUnknowns: [
            'Nature of endpoints',
            'Visualization tool/library to use',
            'Metrics specific for AI models',
          ],
          blockingUnknowns: [
            'Nature of endpoints',
            'Visualization tool/library to use',
            'Metrics specific for AI models',
          ],
        },
        knownRequirements: [],
        unresolvedUnknowns: [
          { key: 'endpoint-type', value: 'unknown' },
          { key: 'visualization-tool', value: 'unknown' },
          { key: 'ai-metrics', value: 'unknown' },
        ],
        blockingUnknowns: [
          { key: 'endpoint-type', value: 'unknown' },
          { key: 'visualization-tool', value: 'unknown' },
          { key: 'ai-metrics', value: 'unknown' },
        ],
        resolvedQuestionKeys: [],
        candidateQuestions: [
          {
            questionKey: 'endpoint-type',
            label: 'What type of endpoints are you monitoring?',
            options: [
              {
                optionKey: 'http',
                label: 'HTTP/HTTPS endpoints',
                description: 'Monitoring API calls via HTTP or HTTPS.',
              },
              {
                optionKey: 'grpc',
                label: 'gRPC endpoints',
                description: 'Monitoring gRPC service calls.',
              },
              {
                optionKey: 'other',
                label: 'Other endpoint types',
                description: 'Specify another endpoint protocol.',
              },
            ],
          },
        ],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Make a rust web server to',
      originalPrompt:
        'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
      context: {
        objective: null,
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: false,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Waiting for the first planning analysis.'],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        },
      ],
    });

    expect(result.unresolvedUnknowns).toEqual([
      'endpoint-type',
      'visualization-tool',
      'ai-metrics',
    ]);
    expect(result.blockingUnknowns).toEqual([
      'endpoint-type',
      'visualization-tool',
      'ai-metrics',
    ]);
    expect(result.candidateQuestions).toEqual([
      expect.objectContaining({
        questionKey: 'endpoint-type',
        question: 'What type of endpoints are you monitoring?',
        category: 'scope',
        whyThisMatters: 'Need this detail to build a reliable implementation plan.',
        required: false,
        blocking: false,
      }),
    ]);
  });

  it('normalizes object-shaped known requirements from clarified analysis output', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        title: 'Make a rust web server to monitor endpoints',
        summary: null,
        contextPatch: {
          blockingUnknowns: [
            'Specific technologies or libraries to use for the 3D visualization',
            'Data sources and formats for endpoint monitoring',
            'Integration method for AI model metrics',
          ],
          knownRequirements: [],
          unresolvedUnknowns: [],
          estimatedComplexity: 'High',
        },
        knownRequirements: [
          {
            requirementKey: 'three-rs',
            description: 'Use three.js Rust bindings for 3D visualization.',
          },
          {
            requirementKey: 'shared-metrics-backend',
            description:
              'Use a shared backend (like Prometheus) to fetch metrics from AI models.',
          },
          {
            requirementKey: 'opentelemetry',
            description:
              'Use OpenTelemetry to collect and export telemetry data with various backends.',
          },
        ],
        unresolvedUnknowns: [
          'Specific details on the types of endpoints being monitored',
          'Frequency requirements for updating the visualization in real time',
          'Security and authentication mechanisms needed for accessing the metrics and dashboard',
        ],
        blockingUnknowns: [],
        resolvedQuestionKeys: [
          'visualization-library',
          'integration-method',
          'data-sources',
        ],
        candidateQuestions: [
          {
            questionKey: 'endpoint-types',
            category: 'technical',
            question: 'Specify types of endpoints being monitored',
            whyThisMatters:
              'Need this detail to tailor monitoring strategies and chart configurations.',
            options: [
              {
                optionKey: 'http-endpoints',
                label: 'HTTP Endpoints',
                description: 'Monitor standard HTTP REST APIs.',
              },
              {
                optionKey: 'grpc-services',
                label: 'gRPC Services',
                description: 'Monitor services using the gRPC protocol.',
              },
              {
                optionKey: 'custom-protocols',
                label: 'Custom Protocols',
                description:
                  'Monitor endpoints that use proprietary or custom protocols.',
              },
            ],
            selectedOptionKey: null,
            answerNote: null,
            status: 'pending',
            required: true,
            blocking: true,
          },
        ],
        confidence: 75,
        recommendedNextAction: 'define_acceptance_criteria',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Make a rust web server to monitor endpoints',
      originalPrompt:
        'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
      context: {
        objective:
          'Develop a Rust web server to visualize endpoint monitoring on a 3D chart and serve as a metrics monitor for AI models.',
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [
          'Specific technologies or libraries to use for the 3D visualization',
          'Data sources and formats for endpoint monitoring',
          'Integration method for AI model metrics',
        ],
        blockingUnknowns: [
          'Specific technologies or libraries to use for the 3D visualization',
          'Data sources and formats for endpoint monitoring',
          'Integration method for AI model metrics',
        ],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [
          'Specific technologies or libraries to use for the 3D visualization',
          'Data sources and formats for endpoint monitoring',
          'Integration method for AI model metrics',
        ],
        blockingUnknowns: [
          'Specific technologies or libraries to use for the 3D visualization',
          'Data sources and formats for endpoint monitoring',
          'Integration method for AI model metrics',
        ],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: [
          'Objective is clear.',
          'Scope is still materially unbounded.',
          'Acceptance criteria are still missing.',
          'Blocking unknowns still need clarification.',
          'Confidence is still below the planning threshold.',
        ],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        },
      ],
    });

    expect(result.knownRequirements).toEqual([
      'Use three.js Rust bindings for 3D visualization.',
      'Use a shared backend (like Prometheus) to fetch metrics from AI models.',
      'Use OpenTelemetry to collect and export telemetry data with various backends.',
    ]);
    expect(result.contextPatch.estimatedComplexity).toBe('high');
    expect(result.confidence).toBe(0.75);
    expect(result.recommendedNextAction).toBe('ask_clarification');
    expect(result.resolvedQuestionKeys).toEqual([
      'visualization-library',
      'integration-method',
      'data-sources',
    ]);
    expect(result.candidateQuestions).toEqual([
      expect.objectContaining({
        questionKey: 'endpoint-types',
        question: 'Specify types of endpoints being monitored',
        required: true,
        blocking: true,
      }),
    ]);
  });

  it('normalizes low integer confidence values onto a 0 to 1 scale for analysis output', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        title: 'Clarify platform objectives',
        summary: 'The request is now bounded enough to plan.',
        contextPatch: {
          objective: 'Create a fintech event monitoring platform.',
          inScope: ['globe visualization'],
          acceptanceCriteria: ['A structured implementation plan is generated.'],
        },
        knownRequirements: ['Build the platform in Next.js'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        resolvedQuestionKeys: ['stock-market-chart-data'],
        candidateQuestions: [],
        confidence: 2,
        recommendedNextAction: 'generate_plan',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Clarify platform objectives',
      originalPrompt: 'Plan a fintech platform with a globe view and market impact tracking.',
      context: {
        objective: null,
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: false,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Waiting for the first planning analysis.'],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content: 'Plan a fintech platform with a globe view and market impact tracking.',
        },
      ],
    });

    expect(result.confidence).toBe(0.2);
    expect(result.recommendedNextAction).toBe('generate_plan');
  });

  it('filters placeholder unknown strings out of normalized analysis output', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        title: 'Clarify monitoring platform scope',
        summary: 'The request still needs one more concrete scope boundary.',
        contextPatch: {
          blockingUnknowns: ['No known blocking unknowns at this stage.'],
          unresolvedUnknowns: ['No known unresolved unknowns at this stage.'],
        },
        knownRequirements: ['Use Rust'],
        unresolvedUnknowns: ['No known unresolved unknowns at this stage.'],
        blockingUnknowns: ['No known blocking unknowns at this stage.'],
        resolvedQuestionKeys: [],
        candidateQuestions: [],
        confidence: 0.95,
        recommendedNextAction: 'ask_clarification',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Clarify monitoring platform scope',
      originalPrompt: 'Plan a Rust monitoring platform for endpoints and dashboards.',
      context: {
        objective: 'Build a Rust monitoring platform.',
        summary: null,
        targetOutcome: null,
        inScope: ['Endpoint monitoring'],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Waiting for the next planning analysis.'],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content: 'Plan a Rust monitoring platform for endpoints and dashboards.',
        },
      ],
    });

    expect(result.blockingUnknowns).toEqual([]);
    expect(result.unresolvedUnknowns).toEqual([]);
    expect(result.contextPatch.blockingUnknowns).toEqual([]);
    expect(result.contextPatch.unresolvedUnknowns).toEqual([]);
  });

  it('clamps verbose note-echoed analysis fields and normalizes readiness aliases before schema validation', async () => {
    const oversizedRequirement = 'Use the note context to refine the implementation path. '.repeat(8);
    const oversizedUnknown = 'Clarify how the market impact note should influence planning decisions. '.repeat(6);
    const oversizedQuestion = 'What additional scope should the planning note unlock for the generated plan? '.repeat(5);
    const oversizedReason =
      'This answer note changes implementation sequencing and needs to stay within the guided-card format. '.repeat(4);
    const oversizedDescription =
      'Use the persisted answer note to bias implementation choices while keeping the plan deterministic. '.repeat(4);

    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        title: 'Clarify planning note handling',
        summary: 'The note-heavy request is bounded enough to plan safely.',
        contextPatch: {
          summary:
            'Use clarification notes as supplemental context without letting them destabilize schema validation.',
          acceptanceCriteria: [oversizedRequirement],
          technicalDecisions: [
            {
              area: 'answer-note-handling-for-clarification-replies'.repeat(4),
              choice: oversizedRequirement,
              rationale: oversizedReason,
              source: 'assumed',
            },
          ],
        },
        knownRequirements: [oversizedRequirement],
        unresolvedUnknowns: [oversizedUnknown],
        blockingUnknowns: [oversizedUnknown],
        resolvedQuestionKeys: ['note-handling-decision-for-planning-mode'.repeat(5)],
        candidateQuestions: [
          {
            questionKey: 'planning-note-surface-selection-for-analysis-replies'.repeat(4),
            question: oversizedQuestion,
            category: 'technical',
            whyThisMatters: oversizedReason,
            options: [
              {
                optionKey: 'structured-note-payload-for-analysis-and-clarification'.repeat(3),
                label: 'Structured note payload for every clarification reply keeps the model informed.'.repeat(3),
                description: oversizedDescription,
                isRecommended: true,
              },
              {
                optionKey: 'note-only-when-none-of-the-above-is-selected'.repeat(3),
                label: 'Only use note text when none of the above is selected.'.repeat(3),
                description: oversizedDescription,
              },
              {
                optionKey: 'persist-notes-but-omit-them-from-every-next-turn-summary'.repeat(3),
                label: 'Persist notes but omit them from the user transcript summary.'.repeat(3),
                description: oversizedDescription,
              },
            ],
            required: true,
            blocking: true,
          },
        ],
        confidence: 1,
        recommendedNextAction: 'ready-to-plan',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Clarify planning note handling',
      originalPrompt:
        'Plan how clarification notes should be handled when a user answers guided cards with extra context.',
      context: {
        objective: null,
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: false,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Waiting for the first planning analysis.'],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'Plan how clarification notes should be handled when a user answers guided cards with extra context.',
        },
      ],
    });

    expect(result.recommendedNextAction).toBe('generate_plan');
    expect(result.knownRequirements[0]?.length).toBeLessThanOrEqual(240);
    expect(result.blockingUnknowns[0]?.length).toBeLessThanOrEqual(240);
    expect(result.resolvedQuestionKeys[0]?.length).toBeLessThanOrEqual(80);
    expect(result.candidateQuestions[0]?.questionKey.length).toBeLessThanOrEqual(80);
    expect(result.candidateQuestions[0]?.question.length).toBeLessThanOrEqual(280);
    expect(result.candidateQuestions[0]?.whyThisMatters.length).toBeLessThanOrEqual(220);
    expect(result.candidateQuestions[0]?.options[0]?.optionKey.length).toBeLessThanOrEqual(80);
    expect(result.candidateQuestions[0]?.options[0]?.label.length).toBeLessThanOrEqual(120);
    expect(result.candidateQuestions[0]?.options[0]?.description.length).toBeLessThanOrEqual(220);
    expect(result.contextPatch.acceptanceCriteria?.[0]?.length).toBeLessThanOrEqual(240);
    expect(result.contextPatch.technicalDecisions?.[0]?.area.length).toBeLessThanOrEqual(120);
    expect(result.contextPatch.technicalDecisions?.[0]?.choice.length).toBeLessThanOrEqual(240);
    expect(result.contextPatch.technicalDecisions?.[0]?.rationale.length).toBeLessThanOrEqual(320);
  });

  it('normalizes echoed-session analysis output with oversized titles and missing top-level arrays', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        sessionTitle: 'Make a rust web server to',
        title:
          'Make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        summary:
          'The user wants to create a Rust-based web server that monitors various endpoints and displays their activity on a 3D chart. Additionally, a metrics monitor for AI models needs to be developed.',
        contextPatch: {
          blockingUnknowns: [
            'The specific types of metrics to be monitored for AI models.',
            'The data sources for the endpoint monitoring.',
            'The desired level of detail in the 3D visualization.',
          ],
          unresolvedUnknowns: [],
        },
        knownRequirements: [],
        resolvedQuestionKeys: [],
        candidateQuestions: [
          {
            questionKey: 'metric-types',
            label: 'What types of metrics do you want to monitor for your AI models?',
            description:
              "Identify the key performance indicators (KPIs) relevant to your AI models' operations.",
            options: [
              {
                optionKey: 'response-time',
                label: 'Response Time',
                description:
                  'Monitor how long it takes for requests to be processed by your AI models.',
                isRecommended: true,
              },
              {
                optionKey: 'accuracy-rate',
                label: 'Accuracy Rate',
                description:
                  'Track the accuracy of predictions made by your AI models.',
              },
              {
                optionKey: 'throughput',
                label: 'Throughput',
                description:
                  'Measure the number of requests processed per unit of time.',
              },
            ],
          },
        ],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
      })
    );

    const { analyzePlanningTurn } = await import('@/lib/ai/planning');
    const result = await analyzePlanningTurn({
      sessionTitle: 'Make a rust web server to',
      originalPrompt:
        'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
      context: {
        objective: null,
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [],
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: null,
        planningConfidence: 0,
      },
      readiness: {
        objectiveClear: false,
        scopeBounded: false,
        hasAcceptanceCriteria: false,
        knownRequirements: [],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 0,
        recommendedNextAction: 'ask_clarification',
        reasonSummary: ['Waiting for the first planning analysis.'],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        },
      ],
    });

    expect(result.title?.length).toBeLessThanOrEqual(120);
    expect(result.title).toContain('Make a rust web server to monitor');
    expect(result.blockingUnknowns).toEqual([
      'The specific types of metrics to be monitored for AI models.',
      'The data sources for the endpoint monitoring.',
      'The desired level of detail in the 3D visualization.',
    ]);
    expect(result.unresolvedUnknowns).toEqual([
      'The specific types of metrics to be monitored for AI models.',
      'The data sources for the endpoint monitoring.',
      'The desired level of detail in the 3D visualization.',
    ]);
    expect(result.candidateQuestions).toEqual([
      expect.objectContaining({
        questionKey: 'metric-types',
        question: 'What types of metrics do you want to monitor for your AI models?',
        required: false,
        blocking: false,
      }),
    ]);
  });

  it('normalizes loose plan artifact output into the persisted plan shape', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        summary:
          'Implementation plan for creating a Rust web server to monitor endpoints and AI model metrics.',
        objective:
          'Create a Rust web server that monitors endpoint latency, displays monitoring data on a 3D chart using Three.js, and integrates AI model metrics with Prometheus + Grafana.',
        scope: {
          features: [
            'Monitor endpoint latency',
            'Display monitoring data on a 3D chart using Three.js',
            'Integrate AI model metrics with Prometheus + Grafana',
          ],
        },
        assumptions: [
          'The implementation will be within the capabilities of the chosen technologies.',
        ],
        constraints: [
          'Must use a Rust web server',
          'Endpoint data collection should be handled by Actix Web',
        ],
        affectedAreas: [
          'Rust programming environment',
          '3D chart implementation with Three.js',
        ],
        implementationPhases: [
          {
            phaseName: 'Setup Rust Development Environment',
            tasks: [
              {
                taskName: 'Install Rust SDK',
                acceptanceCriteria: ['Rust SDK is installed and verified'],
              },
              {
                taskName:
                  'Configure Cargo.toml for Actix Web, Tokio Insight, SSE, and Prometheus exporter',
                acceptanceCriteria: [
                  'Dependencies are correctly specified and compiled',
                ],
              },
            ],
          },
        ],
        risks: [
          'Compatibility issues between Actix Web, Tokio Insight, Three.js, and Prometheus + Grafana.',
        ],
        successCriteria: [
          'The server should monitor endpoint latency',
          'Monitor data should be displayed on a 3D chart using Three.js',
        ],
        openQuestions: [],
      })
    );

    const { generatePlanningArtifact } = await import('@/lib/ai/planning');
    const result = await generatePlanningArtifact({
      sessionTitle: 'Make a rust web server to monitor endpoints and AI model metrics',
      originalPrompt:
        'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
      context: {
        objective: 'Create a Rust web server for monitoring endpoints and AI model metrics',
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [
          'The server should monitor endpoint latency',
          'Monitor data should be displayed on a 3D chart using Three.js',
          'AI model metrics should be integrated with Prometheus + Grafana',
        ],
        knownRequirements: [
          'Use a Rust web server',
          'Monitor endpoint latency',
          'Display monitoring data on a 3D chart using Three.js',
          'Integrate AI model metrics with Prometheus + Grafana',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'medium',
        planningConfidence: 1,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        knownRequirements: [
          'Use a Rust web server',
          'Monitor endpoint latency',
          'Display monitoring data on a 3D chart using Three.js',
          'Integrate AI model metrics with Prometheus + Grafana',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 1,
        recommendedNextAction: 'generate_plan',
        reasonSummary: [
          'Objective is clear.',
          'Scope is reasonably bounded.',
          'Acceptance criteria are present or inferable.',
          'No blocking unknowns remain.',
          'Confidence is high enough to plan.',
        ],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        },
      ],
    });

    expect(result.scope).toEqual({
      inScope: [
        'Monitor endpoint latency',
        'Display monitoring data on a 3D chart using Three.js',
        'Integrate AI model metrics with Prometheus + Grafana',
      ],
      outOfScope: [],
    });
    expect(result.implementationPhases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'setup-rust-development-environment',
          title: 'Setup Rust Development Environment',
          summary: 'Complete setup rust development environment.',
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'install-rust-sdk',
              title: 'Install Rust SDK',
              description: 'Install Rust SDK',
              type: 'implementation',
              priority: 'medium',
              dependencyIds: [],
              acceptanceCriteria: ['Rust SDK is installed and verified'],
            }),
          ]),
        }),
      ])
    );
  });

  it('coerces string task acceptance criteria into single-item arrays in final plan output', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        summary: 'Create the monitoring platform in phased workstreams.',
        objective: 'Ship a Rust monitoring service with a browser-based operations dashboard.',
        scope: {
          inScope: ['Endpoint monitoring', '3D dashboard'],
          outOfScope: ['Automated remediation'],
        },
        assumptions: [],
        constraints: ['Use Rust on the backend.'],
        affectedAreas: ['Backend', 'Frontend'],
        implementationPhases: [
          {
            title: 'Backend foundation',
            tasks: [
              {
                title: 'Stand up the Rust service',
                acceptanceCriteria: 'The service boots locally and exposes a health endpoint.',
              },
            ],
          },
        ],
        risks: [],
        successCriteria: ['Operators can inspect endpoint health from the dashboard.'],
        openQuestions: [],
      })
    );

    const { generatePlanningArtifact } = await import('@/lib/ai/planning');
    const result = await generatePlanningArtifact({
      sessionTitle: 'Plan the endpoint monitoring platform',
      originalPrompt: 'Create a Rust monitoring platform with a dashboard.',
      context: {
        objective: 'Create a Rust monitoring platform.',
        summary: null,
        targetOutcome: null,
        inScope: ['Endpoint monitoring', '3D dashboard'],
        outOfScope: ['Automated remediation'],
        assumptions: [],
        constraints: ['Use Rust on the backend.'],
        acceptanceCriteria: ['Operators can inspect endpoint health from the dashboard.'],
        knownRequirements: ['Rust backend', 'Dashboard UI'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'medium',
        planningConfidence: 1,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        knownRequirements: ['Rust backend', 'Dashboard UI'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 1,
        recommendedNextAction: 'generate_plan',
        reasonSummary: [
          'Objective is clear.',
          'Scope is reasonably bounded.',
          'Acceptance criteria are present.',
        ],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content: 'Create a Rust monitoring platform with a dashboard.',
        },
      ],
    });

    expect(result.implementationPhases[0]?.tasks[0]?.acceptanceCriteria).toEqual([
      'The service boots locally and exposes a health endpoint.',
    ]);
  });

  it('defaults missing top-level artifact arrays so omitted planner fields do not fail schema validation', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        summary: 'Create the monitoring platform in phased workstreams.',
        objective: 'Ship a Rust monitoring service with a browser-based operations dashboard.',
        scope: {
          inScope: ['Endpoint monitoring', '3D dashboard'],
          outOfScope: ['Automated remediation'],
        },
        implementationPhases: [
          {
            title: 'Backend foundation',
            tasks: [
              {
                title: 'Stand up the Rust service',
                acceptanceCriteria: ['The service boots locally and exposes a health endpoint.'],
              },
            ],
          },
        ],
      })
    );

    const { generatePlanningArtifact } = await import('@/lib/ai/planning');
    const result = await generatePlanningArtifact({
      sessionTitle: 'Plan the endpoint monitoring platform',
      originalPrompt: 'Create a Rust monitoring platform with a dashboard.',
      context: {
        objective: 'Create a Rust monitoring platform.',
        summary: null,
        targetOutcome: null,
        inScope: ['Endpoint monitoring', '3D dashboard'],
        outOfScope: ['Automated remediation'],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: ['Operators can inspect endpoint health from the dashboard.'],
        knownRequirements: ['Rust backend', 'Dashboard UI'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'medium',
        planningConfidence: 1,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        knownRequirements: ['Rust backend', 'Dashboard UI'],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 1,
        recommendedNextAction: 'generate_plan',
        reasonSummary: [
          'Objective is clear.',
          'Scope is reasonably bounded.',
          'Acceptance criteria are present.',
        ],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content: 'Create a Rust monitoring platform with a dashboard.',
        },
      ],
    });

    expect(result.assumptions).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.affectedAreas).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.successCriteria).toEqual([]);
    expect(result.openQuestions).toEqual([]);
  });

  it('normalizes object-shaped phases, string tasks, and risk objects in final plan output', async () => {
    mockedCompleteAiStructuredJson.mockImplementation(async ({ schema }) =>
      schema.parse({
        summary:
          'Create a Rust web server to monitor endpoints and AI model metrics using Actix Web, Three.js for visualization, Prometheus + Grafana for integration, Server-Sent Events for real-time updates, and Tokio Insight for performance monitoring.',
        objective:
          'Deploy a robust Rust web server that monitors endpoint latency and serves AI model metrics on a 3D visual representation in real-time.',
        scope: [
          'Develop a Rust-based web server using Actix Web',
          'Integrate Three.js for a 3D chart display of endpoint data',
          'Set up Prometheus + Grafana for AI model metrics monitoring',
        ],
        assumptions: [
          'Development environment is ready with Rust and necessary tools installed.',
        ],
        constraints: [
          'Must adhere to a specific development timeline.',
          'Use only open-source technologies for the implementation.',
        ],
        affectedAreas: [
          'Backend infrastructure (Rust server)',
          'Frontend visualizations (3D chart with Three.js)',
        ],
        implementationPhases: {
          Phase1: {
            tasks: [
              'Set up the Actix Web server for handling requests and collecting metrics.',
              'Configure Prometheus and Grafana for AI model metrics collection and visualization.',
            ],
          },
          Phase2: {
            tasks: [
              'Integrate Three.js into a web interface to display endpoint monitoring data.',
            ],
          },
        },
        risks: [
          {
            risk: 'High-latency in data transmission',
            mitigation:
              'Optimize SSE implementation and ensure efficient data transfer protocols.',
          },
          {
            risk: 'Inaccurate or missing metrics due to improper setup',
            mitigation:
              'Conduct thorough testing of Prometheus + Grafana integration.',
          },
        ],
        successCriteria: [
          'The server successfully monitors endpoint latency.',
          'Monitor data is displayed on a 3D chart using Three.js in real-time.',
        ],
        openQuestions: [],
      })
    );

    const { generatePlanningArtifact } = await import('@/lib/ai/planning');
    const result = await generatePlanningArtifact({
      sessionTitle: 'Make a rust web server to monitor endpoints and AI model metrics',
      originalPrompt:
        'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
      context: {
        objective: 'Create a Rust web server for monitoring endpoints and AI model metrics',
        summary: null,
        targetOutcome: null,
        inScope: [],
        outOfScope: [],
        assumptions: [],
        constraints: [],
        acceptanceCriteria: [
          'The server should monitor endpoint latency',
          'Monitor data should be displayed on a 3D chart using Three.js',
          'AI model metrics should be integrated with Prometheus + Grafana',
        ],
        knownRequirements: [
          'Use a Rust web server',
          'Monitor endpoint latency',
          'Display monitoring data on a 3D chart using Three.js',
          'Integrate AI model metrics with Prometheus + Grafana',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        affectedAreas: [],
        risks: [],
        dependencies: [],
        estimatedComplexity: 'medium',
        planningConfidence: 1,
      },
      readiness: {
        objectiveClear: true,
        scopeBounded: true,
        hasAcceptanceCriteria: true,
        knownRequirements: [
          'Use a Rust web server',
          'Monitor endpoint latency',
          'Display monitoring data on a 3D chart using Three.js',
          'Integrate AI model metrics with Prometheus + Grafana',
        ],
        unresolvedUnknowns: [],
        blockingUnknowns: [],
        confidence: 1,
        recommendedNextAction: 'generate_plan',
        reasonSummary: [
          'Objective is clear.',
          'Scope is reasonably bounded.',
          'Acceptance criteria are present or inferable.',
          'No blocking unknowns remain.',
          'Confidence is high enough to plan.',
        ],
      },
      questions: [],
      messages: [
        {
          role: 'user',
          content:
            'I want to make a rust web server to monitor all of my endpoints on a visual 3d chart that shows where theyre actively going. I also want to develop a mertrics monitor for my Ai models',
        },
      ],
    });

    expect(result.scope).toEqual({
      inScope: [
        'Develop a Rust-based web server using Actix Web',
        'Integrate Three.js for a 3D chart display of endpoint data',
        'Set up Prometheus + Grafana for AI model metrics monitoring',
      ],
      outOfScope: [],
    });
    expect(result.implementationPhases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'phase1',
          title: 'Phase1',
          summary: 'Complete phase1.',
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'set-up-the-actix-web-server-for-handling-requests-and-collecting-metrics',
              title:
                'Set up the Actix Web server for handling requests and collecting metrics.',
              description:
                'Set up the Actix Web server for handling requests and collecting metrics.',
              acceptanceCriteria: [],
            }),
            expect.objectContaining({
              id: 'configure-prometheus-and-grafana-for-ai-model-metrics-collection-and-visualizati',
              title:
                'Configure Prometheus and Grafana for AI model metrics collection and visualization.',
              description:
                'Configure Prometheus and Grafana for AI model metrics collection and visualization.',
              acceptanceCriteria: [],
            }),
          ]),
        }),
        expect.objectContaining({
          id: 'phase2',
          title: 'Phase2',
        }),
      ])
    );
    expect(result.risks).toEqual([
      'High-latency in data transmission',
      'Inaccurate or missing metrics due to improper setup',
    ]);
  });
});
