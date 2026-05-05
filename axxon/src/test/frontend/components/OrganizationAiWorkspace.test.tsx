// Exercises the shared org AI workspace for assistant regression coverage and persisted planning-mode behavior.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchOrganization,
  mockedFetchOrganizationAiThreads,
  mockedFetchOrganizationAiThread,
  mockedStreamOrganizationAiChat,
  mockedFetchBoards,
  mockedFetchOrganizationAiPlanningSessions,
  mockedFetchOrganizationAiPlanningSession,
  mockedCreateOrganizationAiPlanningSession,
  mockedCreateOrganizationAiPlanningSessionMessage,
  mockedProcessOrganizationAiPlanningSession,
  mockedUsePathname,
  mockedUseRouter,
  mockedUseSearchParams,
  mockedUseSocket,
  planningSocket,
} = vi.hoisted(() => ({
  mockedFetchOrganization: vi.fn(),
  mockedFetchOrganizationAiThreads: vi.fn(),
  mockedFetchOrganizationAiThread: vi.fn(),
  mockedStreamOrganizationAiChat: vi.fn(),
  mockedFetchBoards: vi.fn(),
  mockedFetchOrganizationAiPlanningSessions: vi.fn(),
  mockedFetchOrganizationAiPlanningSession: vi.fn(),
  mockedCreateOrganizationAiPlanningSession: vi.fn(),
  mockedCreateOrganizationAiPlanningSessionMessage: vi.fn(),
  mockedProcessOrganizationAiPlanningSession: vi.fn(),
  mockedUsePathname: vi.fn(),
  mockedUseRouter: vi.fn(),
  mockedUseSearchParams: vi.fn(),
  mockedUseSocket: vi.fn(),
  planningSocket: (() => {
    const handlers = new Map<string, Set<(...args: any[]) => void>>();
    const socket = {
      emit: vi.fn(),
      off: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.get(event)?.delete(handler);
      }),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        const bucket = handlers.get(event) ?? new Set<(...args: any[]) => void>();
        bucket.add(handler);
        handlers.set(event, bucket);
      }),
      reset() {
        handlers.clear();
        socket.emit.mockClear();
        socket.off.mockClear();
        socket.on.mockClear();
      },
      trigger(event: string, ...args: unknown[]) {
        for (const handler of handlers.get(event) ?? []) {
          handler(...args);
        }
      },
    };

    return socket;
  })(),
}));

vi.mock('next/navigation', () => ({
  usePathname: mockedUsePathname,
  useRouter: mockedUseRouter,
  useSearchParams: mockedUseSearchParams,
}));

vi.mock('@/lib/api/organizations/getOrganization', () => ({
  fetchOrganization: mockedFetchOrganization,
}));

vi.mock('@/lib/api/organizations/getOrganizationAiThreads', () => ({
  fetchOrganizationAiThreads: mockedFetchOrganizationAiThreads,
}));

vi.mock('@/lib/api/organizations/getOrganizationAiThread', () => ({
  fetchOrganizationAiThread: mockedFetchOrganizationAiThread,
}));

vi.mock('@/lib/api/organizations/streamOrganizationAiChat', () => ({
  streamOrganizationAiChat: mockedStreamOrganizationAiChat,
}));

vi.mock('@/lib/api/boards/getBoards', () => ({
  fetchBoards: mockedFetchBoards,
}));

vi.mock('@/lib/api/organizations/getOrganizationAiPlanningSessions', () => ({
  fetchOrganizationAiPlanningSessions: mockedFetchOrganizationAiPlanningSessions,
}));

vi.mock('@/lib/api/organizations/getOrganizationAiPlanningSession', () => ({
  fetchOrganizationAiPlanningSession: mockedFetchOrganizationAiPlanningSession,
}));

vi.mock('@/lib/api/organizations/createOrganizationAiPlanningSession', () => ({
  createOrganizationAiPlanningSession: mockedCreateOrganizationAiPlanningSession,
}));

vi.mock('@/lib/api/organizations/createOrganizationAiPlanningSessionMessage', () => ({
  createOrganizationAiPlanningSessionMessage:
    mockedCreateOrganizationAiPlanningSessionMessage,
}));

vi.mock('@/lib/api/organizations/processOrganizationAiPlanningSession', () => ({
  processOrganizationAiPlanningSession: mockedProcessOrganizationAiPlanningSession,
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: mockedUseSocket,
}));

import OrganizationAiWorkspace from '@/components/features/organizationAi/OrganizationAiWorkspace';
import { renderWithProviders } from '../renderWithProviders';

function buildPlanningDetail(overrides: Record<string, unknown> = {}) {
  const overrideMessages = overrides.messages as unknown[] | undefined;
  const overrideQuestions = overrides.questions as unknown[] | undefined;
  const overridePlanArtifact = overrides.planArtifact;
  const session = {
    id: 12,
    organization_id: 3,
    board_id: 7,
    created_by: 1,
    title: 'Planner workspace polish',
    summary: 'Plan the board planning workspace.',
    original_prompt: 'Plan the workspace',
    planner_state: 'plan_generated',
    clarification_turn_count: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...(overrides.session as Record<string, unknown> | undefined),
  };
  const defaultRunState =
    session.planner_state === 'queued'
      ? { state: 'queued', stage: 'queued' }
      : session.planner_state === 'analyzing'
        ? { state: 'running', stage: 'analyzing' }
        : session.planner_state === 'planning'
          ? { state: 'running', stage: 'planning' }
          : session.planner_state === 'clarifying'
            ? { state: 'waiting_for_clarification', stage: 'clarifying' }
            : session.planner_state === 'failed'
              ? { state: 'failed', stage: 'failed' }
              : { state: 'completed', stage: 'completed' };

  return {
    session,
    messages:
      overrideMessages ??
      [
        {
          id: 21,
          session_id: 12,
          role: 'assistant',
          message_kind: 'plan_summary',
          content: 'Plan generated.\n\nBuild the planning mode in phases.',
          sequence_number: 1,
          status: 'completed',
          metadata_json: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    questions: overrideQuestions ?? [],
    context: {
      objective: 'Ship planning mode',
      summary: 'Build the planning mode.',
      targetOutcome: 'A structured planning workspace',
      inScope: ['Planning mode'],
      outOfScope: ['Task auto-creation'],
      assumptions: [],
      constraints: [],
      acceptanceCriteria: ['User receives a plan'],
      knownRequirements: ['Assistant stays intact'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      affectedAreas: ['frontend', 'backend'],
      risks: ['Local model JSON quality'],
      dependencies: [],
      technicalDecisions: [
        {
          area: 'runtime',
          choice: 'Use the existing planning workspace',
          rationale: 'Keeps the MVP inside the current org AI surface.',
          source: 'assumed',
        },
      ],
      estimatedComplexity: 'high',
      planningConfidence: 0.92,
      ...(overrides.context as Record<string, unknown> | undefined),
    },
    readiness: {
      objectiveClear: true,
      scopeBounded: true,
      hasAcceptanceCriteria: true,
      knownRequirements: ['Assistant stays intact'],
      unresolvedUnknowns: [],
      blockingUnknowns: [],
      confidence: 0.92,
      recommendedNextAction: 'generate_plan',
      reasonSummary: ['Ready to plan'],
      ...(overrides.readiness as Record<string, unknown> | undefined),
    },
    planArtifact:
      overridePlanArtifact === null
        ? null
        : {
            summary: 'Build the planning mode in phases.',
            objective: 'Ship board-bound planning mode.',
            scope: {
              inScope: ['Planning mode'],
              outOfScope: ['Task auto-creation'],
            },
            assumptions: ['Assistant mode stays separate.'],
            constraints: ['No repo reads'],
            affectedAreas: ['frontend', 'backend'],
            technicalDecisions: [
              {
                area: 'surface',
                choice: 'Keep planning inside the org AI workspace',
                rationale: 'Avoids adding a separate board page during the MVP.',
                source: 'assumed',
              },
            ],
            implementationPhases: [
              {
                id: 'phase-1',
                title: 'Backend foundation',
                summary: 'Add planning persistence and orchestration.',
                tasks: [
                  {
                    id: 'task-1',
                    title: 'Persist sessions',
                    description: 'Create the planning session tables and models.',
                    type: 'backend',
                    priority: 'high',
                    dependencyIds: [],
                    acceptanceCriteria: ['Planning sessions persist per board.'],
                  },
                ],
              },
            ],
            risks: ['Local model JSON quality'],
            successCriteria: ['Users can review a structured plan.'],
            openQuestions: [],
            ...(overridePlanArtifact as Record<string, unknown> | undefined),
          },
    activeRun: {
      id: 73,
      session_id: Number(session.id),
      trigger_message_id: 19,
      status_message_id: 21,
      executor_kind: 'local_ollama',
      ...defaultRunState,
      attempt_count: 1,
      provider_job_id: null,
      metadata_json: {
        phaseCount: 1,
      },
      error_message: null,
      started_at: '2026-01-01T00:00:00.000Z',
      finished_at: '2026-01-01T00:01:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:01:00.000Z',
      ...(overrides.activeRun as Record<string, unknown> | undefined),
    },
  };
}

function createControlledAssistantStream(threadId = '44') {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  return {
    response: new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controllerRef = controller;
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-Axxon-Ai-Thread-Id': threadId,
        },
      }
    ),
    push(event: Record<string, unknown>) {
      if (!controllerRef) {
        throw new Error('The assistant stream has not started yet.');
      }

      controllerRef.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    close() {
      controllerRef?.close();
    },
  };
}

function hasTextContent(content: string) {
  return (_: string, element?: Element | null) => {
    if (!element?.textContent?.includes(content)) {
      return false;
    }

    return Array.from(element.children).every(
      (child) => !child.textContent?.includes(content)
    );
  };
}

function getAssistantTranscript(textarea: HTMLTextAreaElement) {
  const form = textarea.closest('form');

  if (!form) {
    throw new Error('Assistant composer form was not found.');
  }

  const transcriptRegion = form.previousElementSibling;

  if (!(transcriptRegion instanceof HTMLDivElement)) {
    throw new Error('Assistant transcript wrapper was not found.');
  }

  const transcript = transcriptRegion.firstElementChild;

  if (!(transcript instanceof HTMLDivElement)) {
    throw new Error('Assistant transcript was not found.');
  }

  return transcript;
}

function getPlanningLayout(textarea: HTMLTextAreaElement) {
  const form = textarea.closest('form');

  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Planning composer form was not found.');
  }

  const centerColumn = form.parentElement;

  if (!(centerColumn instanceof HTMLDivElement)) {
    throw new Error('Planning center column was not found.');
  }

  const workspaceShell = centerColumn.parentElement;

  if (!(workspaceShell instanceof HTMLDivElement)) {
    throw new Error('Planning workspace shell was not found.');
  }

  const sidebar = centerColumn.previousElementSibling;

  if (!(sidebar instanceof HTMLElement)) {
    throw new Error('Planning sidebar was not found.');
  }

  const sidebarScrollRegion = Array.from(sidebar.querySelectorAll('div')).find((element) =>
    element.className.includes('overflow-y-auto')
  );

  if (!(sidebarScrollRegion instanceof HTMLDivElement)) {
    throw new Error('Planning sidebar scroll region was not found.');
  }

  const transcript = Array.from(centerColumn.children).find(
    (element) =>
      element instanceof HTMLDivElement &&
      element.className.includes('overflow-y-auto')
  );

  if (!(transcript instanceof HTMLDivElement)) {
    throw new Error('Planning transcript wrapper was not found.');
  }

  return {
    centerColumn,
    form,
    sidebar,
    sidebarScrollRegion,
    transcript,
    workspaceShell,
  };
}

function mockTranscriptScrollMetrics(
  element: HTMLDivElement,
  {
    scrollHeight = 1200,
    clientHeight = 400,
    scrollTop = 800,
  }: {
    scrollHeight?: number;
    clientHeight?: number;
    scrollTop?: number;
  } = {}
) {
  let currentScrollTop = scrollTop;
  const scrollToMock = vi.fn(
    (
      options?: ScrollToOptions | number,
      legacyTop?: number
    ) => {
      if (typeof options === 'number') {
        currentScrollTop = typeof legacyTop === 'number' ? legacyTop : currentScrollTop;
        return;
      }

      currentScrollTop = options?.top ?? currentScrollTop;
    }
  );

  Object.defineProperties(element, {
    clientHeight: {
      configurable: true,
      get: () => clientHeight,
    },
    scrollHeight: {
      configurable: true,
      get: () => scrollHeight,
    },
    scrollTop: {
      configurable: true,
      get: () => currentScrollTop,
      set: (value: number) => {
        currentScrollTop = value;
      },
    },
    scrollTo: {
      configurable: true,
      value: scrollToMock,
    },
  });

  return {
    getScrollTop: () => currentScrollTop,
    scrollToMock,
    setScrollTop: (value: number) => {
      currentScrollTop = value;
    },
  };
}

function mockReducedMotionPreference(matches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    dispatchEvent: vi.fn(() => true),
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.delete(listener);
        }
      }
    ),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
  } as unknown as MediaQueryList;

  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));

  return mediaQueryList;
}

function mockAssistantAnimationFrame() {
  let nextHandle = 1;
  let nextTimestamp = 16;
  const callbacks = new Map<number, FrameRequestCallback>();
  const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  });
  const cancelAnimationFrameMock = vi.fn((handle: number) => {
    callbacks.delete(handle);
  });

  vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);

  async function flushFrame() {
    const pendingCallbacks = [...callbacks.values()];
    callbacks.clear();

    await act(async () => {
      for (const callback of pendingCallbacks) {
        callback(nextTimestamp);
        nextTimestamp += 16;
      }
    });
  }

  async function flushAllFrames(limit = 20) {
    for (let frame = 0; frame < limit && callbacks.size > 0; frame += 1) {
      await flushFrame();
    }
  }

  return {
    cancelAnimationFrameMock,
    flushAllFrames,
    flushFrame,
    requestAnimationFrameMock,
  };
}

async function waitForAssistantReveal(
  animationFrame: ReturnType<typeof mockAssistantAnimationFrame>,
  minimumRequestCount = 1
) {
  await waitFor(() => {
    expect(animationFrame.requestAnimationFrameMock.mock.calls.length).toBeGreaterThanOrEqual(
      minimumRequestCount
    );
  });

  await animationFrame.flushAllFrames();
}

describe('OrganizationAiWorkspace', () => {
  let currentSearchParams: URLSearchParams;

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    planningSocket.reset();
    currentSearchParams = new URLSearchParams();
    mockedUseSocket.mockReturnValue({ current: planningSocket });
    mockedFetchOrganization.mockResolvedValue({
      id: 3,
      name: 'Platform',
      description: null,
      color: '#6366f1',
      created_by: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      member_count: 4,
      accessible_board_count: 2,
      repo_count: 1,
      current_user_role: 'owner',
    });
    mockedFetchOrganizationAiThreads.mockResolvedValue([]);
    mockedFetchOrganizationAiThread.mockResolvedValue({
      thread: {
        id: 9,
        organization_id: 3,
        created_by: 1,
        title: 'Sprint planning chat',
        summary: 'Plan the next sprint.',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [
        {
          id: 11,
          thread_id: 9,
          role: 'user',
          content: 'Plan the sprint',
          sequence_number: 1,
          status: 'completed',
          model: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    mockedFetchBoards.mockResolvedValue([
      {
        id: '7',
        name: 'Roadmap',
        organization_id: 3,
        created_by: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        color: '#2563eb',
      },
    ]);
    mockedFetchOrganizationAiPlanningSessions.mockResolvedValue([
      {
        id: 12,
        organization_id: 3,
        board_id: 7,
        created_by: 1,
        title: 'Planner workspace polish',
        summary: 'Plan the board planning workspace.',
        original_prompt: 'Plan the workspace',
        planner_state: 'plan_generated',
        clarification_turn_count: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(buildPlanningDetail());
    mockedCreateOrganizationAiPlanningSession.mockResolvedValue(buildPlanningDetail());
    mockedCreateOrganizationAiPlanningSessionMessage.mockResolvedValue(
      buildPlanningDetail()
    );
    mockedProcessOrganizationAiPlanningSession.mockResolvedValue(buildPlanningDetail());
    mockedUsePathname.mockReturnValue('/dashboard/orgs/3/ai');
    mockedUseSearchParams.mockImplementation(() => ({
      get: (key: string) => currentSearchParams.get(key),
      toString: () => currentSearchParams.toString(),
    }));
  });

  function setSearchParam(key: string, value: string) {
    currentSearchParams.set(key, value);
  }

  function createRouterWithSearchSync() {
    return {
      push: vi.fn((url: string) => {
        currentSearchParams = new URLSearchParams(url.split('?')[1] ?? '');
      }),
      replace: vi.fn((url: string) => {
        currentSearchParams = new URLSearchParams(url.split('?')[1] ?? '');
      }),
    };
  }

  it('defaults to assistant mode and still streams assistant replies', async () => {
    mockReducedMotionPreference(false);
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    mockedFetchOrganizationAiThread.mockImplementation(async (_organizationId, threadId) => ({
      thread: {
        id: threadId,
        organization_id: 3,
        created_by: 1,
        title: 'Summary thread',
        summary: 'Summary reply',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages: [
        {
          id: 11,
          thread_id: threadId,
          role: 'user',
          content: 'Summarize the org status',
          sequence_number: 1,
          status: 'completed',
          model: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 12,
          thread_id: threadId,
          role: 'assistant',
          content: '## Summary\n\n- **Hello** there',
          sequence_number: 2,
          status: 'completed',
          model: 'qwen2.5-coder:14b',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    }));
    mockedStreamOrganizationAiChat.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(
                [
                  JSON.stringify({
                    type: 'start',
                    provider: 'local-ollama',
                    model: 'qwen2.5-coder:14b',
                  }),
                  JSON.stringify({
                    type: 'delta',
                    delta: '## Summary\n\n',
                  }),
                  JSON.stringify({
                    type: 'delta',
                    delta: '- **Hello** there',
                  }),
                  JSON.stringify({
                    type: 'done',
                  }),
                ].join('\n') + '\n'
              )
            );
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/x-ndjson',
            'X-Axxon-Ai-Thread-Id': '44',
          },
        }
      )
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(await screen.findByText('Platform AI workspace')).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Assistant' })
    ).toHaveAttribute('aria-selected', 'true');

    const textarea = await screen.findByPlaceholderText(
      'Ask the assistant about planning, execution, or the next MVP step...'
    );
    const animationFrame = mockAssistantAnimationFrame();
    const transcript = getAssistantTranscript(textarea as HTMLTextAreaElement);

    fireEvent.change(textarea, {
      target: {
        value: 'Summarize the org status',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await waitForAssistantReveal(animationFrame);
    await waitFor(() => {
      expect(transcript.textContent).toContain('Hello there');
    });
    expect(router.replace).toHaveBeenCalledWith(
      '/dashboard/orgs/3/ai?mode=assistant&threadId=44',
      {
        scroll: false,
      }
    );
  });

  it('pauses assistant auto-follow when the user scrolls up and resumes on jump to latest', async () => {
    mockReducedMotionPreference(false);
    const router = createRouterWithSearchSync();
    const controlledStream = createControlledAssistantStream();
    mockedUseRouter.mockReturnValue(router);
    mockedStreamOrganizationAiChat.mockResolvedValue(controlledStream.response);

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    const textarea = (await screen.findByPlaceholderText(
      'Ask the assistant about planning, execution, or the next MVP step...'
    )) as HTMLTextAreaElement;
    const animationFrame = mockAssistantAnimationFrame();
    const transcript = getAssistantTranscript(textarea);
    const scrollState = mockTranscriptScrollMetrics(transcript);

    fireEvent.change(textarea, {
      target: {
        value: 'Stream a long answer',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(scrollState.getScrollTop()).toBe(1200);

    scrollState.setScrollTop(200);
    fireEvent.scroll(transcript);

    expect(
      screen.getByRole('button', { name: 'Jump to latest' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Jump to latest' }).parentElement
    ).toHaveClass('left-1/2', '-translate-x-1/2');

    await act(async () => {
      controlledStream.push({
        type: 'delta',
        delta: 'First streamed chunk.',
      });
    });

    expect(screen.queryByText('First streamed chunk.')).not.toBeInTheDocument();

    await animationFrame.flushFrame();

    expect(screen.getByText(hasTextContent('First streamed chunk.'))).toBeInTheDocument();
    expect(scrollState.getScrollTop()).toBe(200);

    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(scrollState.getScrollTop()).toBe(1200);
    expect(scrollState.scrollToMock).toHaveBeenLastCalledWith({
      top: 1200,
      behavior: 'smooth',
    });
    expect(
      screen.queryByRole('button', { name: 'Jump to latest' })
    ).not.toBeInTheDocument();

    const scheduledFramesBeforeSecondDelta =
      animationFrame.requestAnimationFrameMock.mock.calls.length;

    await act(async () => {
      controlledStream.push({
        type: 'delta',
        delta: ' Second streamed chunk.',
      });
    });

    expect(
      screen.queryByText('First streamed chunk. Second streamed chunk.')
    ).not.toBeInTheDocument();

    await waitForAssistantReveal(
      animationFrame,
      scheduledFramesBeforeSecondDelta + 1
    );
    await waitFor(() => {
      expect(transcript.textContent).toContain('Second streamed chunk.');
    });
    expect(scrollState.getScrollTop()).toBe(1200);

    await act(async () => {
      controlledStream.push({
        type: 'done',
      });
      controlledStream.close();
    });
  });

  it('uses an instant jump when reduced motion is enabled', async () => {
    mockReducedMotionPreference(true);
    const router = createRouterWithSearchSync();
    const controlledStream = createControlledAssistantStream();
    mockedUseRouter.mockReturnValue(router);
    mockedStreamOrganizationAiChat.mockResolvedValue(controlledStream.response);

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    const textarea = (await screen.findByPlaceholderText(
      'Ask the assistant about planning, execution, or the next MVP step...'
    )) as HTMLTextAreaElement;
    const transcript = getAssistantTranscript(textarea);
    const scrollState = mockTranscriptScrollMetrics(transcript);

    fireEvent.change(textarea, {
      target: {
        value: 'Reduced motion stream',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await screen.findByText('Thinking...');

    scrollState.setScrollTop(200);
    fireEvent.scroll(transcript);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(scrollState.scrollToMock).toHaveBeenLastCalledWith({
      top: 1200,
      behavior: 'auto',
    });

    await act(async () => {
      controlledStream.push({
        type: 'done',
      });
      controlledStream.close();
    });
  });

  it('paces assistant reveal updates and re-enables auto-follow when a new send starts', async () => {
    mockReducedMotionPreference(false);
    const router = createRouterWithSearchSync();
    const firstStream = createControlledAssistantStream('44');
    const secondStream = createControlledAssistantStream('45');
    mockedUseRouter.mockReturnValue(router);
    mockedFetchOrganizationAiThread.mockImplementation(async (_organizationId, threadId) => ({
      thread: {
        id: threadId,
        organization_id: 3,
        created_by: 1,
        title: `Thread ${threadId}`,
        summary: 'Saved assistant thread',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      messages:
        threadId === 44
          ? [
              {
                id: 21,
                thread_id: 44,
                role: 'user',
                content: 'First stream',
                sequence_number: 1,
                status: 'completed',
                model: null,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 22,
                thread_id: 44,
                role: 'assistant',
                content: 'First streamed chunk. Second streamed chunk.',
                sequence_number: 2,
                status: 'completed',
                model: 'qwen2.5-coder:14b',
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
              },
            ]
          : [],
    }));
    mockedStreamOrganizationAiChat
      .mockResolvedValueOnce(firstStream.response)
      .mockResolvedValueOnce(secondStream.response);

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    const textarea = (await screen.findByPlaceholderText(
      'Ask the assistant about planning, execution, or the next MVP step...'
    )) as HTMLTextAreaElement;
    const animationFrame = mockAssistantAnimationFrame();
    const transcript = getAssistantTranscript(textarea);
    const scrollState = mockTranscriptScrollMetrics(transcript);

    fireEvent.change(textarea, {
      target: {
        value: 'First stream',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    await act(async () => {
      firstStream.push({
        type: 'delta',
        delta: 'First streamed chunk. Second streamed chunk.',
      });
    });

    expect(
      screen.queryByText('First streamed chunk. Second streamed chunk.')
    ).not.toBeInTheDocument();

    await animationFrame.flushFrame();

    expect(screen.getByText(hasTextContent('First streamed chunk.'))).toBeInTheDocument();

    scrollState.setScrollTop(160);
    fireEvent.scroll(transcript);

    expect(
      screen.getByRole('button', { name: 'Jump to latest' })
    ).toBeInTheDocument();

    await act(async () => {
      firstStream.push({
        type: 'done',
      });
      firstStream.close();
    });

    await animationFrame.flushAllFrames();

    expect(transcript.textContent).toContain('Second streamed chunk.');

    expect(
      screen.queryByRole('button', { name: 'Jump to latest' })
    ).not.toBeInTheDocument();

    fireEvent.change(textarea, {
      target: {
        value: 'Second stream',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });
    expect(scrollState.getScrollTop()).toBe(1200);

    await act(async () => {
      secondStream.push({
        type: 'done',
      });
      secondStream.close();
    });
  });

  it('pushes the planning mode query param when the user switches tabs', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Planning' }));

    expect(router.push).toHaveBeenCalledWith('/dashboard/orgs/3/ai?mode=planning', {
      scroll: false,
    });
  });

  it('renders the structured planning view when a planning session is selected', async () => {
    mockedUseRouter.mockReturnValue(createRouterWithSearchSync());
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(await screen.findByText('Board planning sessions')).toBeInTheDocument();
    expect(
      await screen.findByText(hasTextContent('Ship board-bound planning mode.'))
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('tab', { name: 'Implementation' }));
    expect(await screen.findByText('Backend foundation')).toBeInTheDocument();
    expect(await screen.findByText('Persist sessions')).toBeInTheDocument();
  });

  it('keeps the desktop planning shell internally scrollable so the composer stays pinned', async () => {
    mockedUseRouter.mockReturnValue(createRouterWithSearchSync());
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    const textarea = (await screen.findByPlaceholderText(
      'Refine the scope or add another planning turn...'
    )) as HTMLTextAreaElement;
    const {
      centerColumn,
      form,
      sidebar,
      sidebarScrollRegion,
      transcript,
      workspaceShell,
    } = getPlanningLayout(textarea);

    expect(workspaceShell).toHaveClass('xl:grid-rows-[minmax(0,1fr)]');
    expect(sidebar).toHaveClass('xl:min-h-0', 'xl:flex-col', 'xl:overflow-hidden');
    expect(sidebarScrollRegion).toHaveClass(
      'xl:min-h-0',
      'xl:flex-1',
      'xl:overflow-y-auto'
    );
    expect(centerColumn).toHaveClass(
      'xl:min-h-0',
      'xl:flex-col',
      'xl:overflow-hidden'
    );
    expect(transcript).toHaveClass('xl:min-h-0', 'xl:flex-1', 'overflow-y-auto');
    expect(form).toHaveClass('xl:shrink-0');
  });

  it('persists a new planning session, rewrites the url, and lets the queued run continue asynchronously', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    mockedFetchOrganizationAiPlanningSessions.mockResolvedValue([]);
    const clarifyingDetail = buildPlanningDetail({
      session: {
        id: 15,
        planner_state: 'clarifying',
        clarification_turn_count: 1,
      },
      messages: [
        {
          id: 31,
          session_id: 15,
          role: 'user',
          message_kind: 'user_input',
          content: 'Plan the planner workflow',
          sequence_number: 1,
          status: 'completed',
          metadata_json: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 32,
          session_id: 15,
          role: 'assistant',
          message_kind: 'clarification_questions',
          content:
            'I need one quick decision before I can build a reliable implementation plan.',
          sequence_number: 2,
          status: 'completed',
          metadata_json: {
            questionKeys: ['scope-board-surface'],
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 4,
          session_id: 15,
          question_key: 'scope-board-surface',
          category: 'scope',
          question_text: 'Which surface should own the planner first?',
          why_this_matters: 'This changes the UX entrypoint.',
          options_json: [
            {
              optionKey: 'workspace-ui',
              label: 'Workspace UI',
              description: 'Keep planning in the existing AI workspace.',
              isRecommended: true,
            },
            {
              optionKey: 'board-view',
              label: 'Board view',
              description: 'Put planning directly on the board.',
            },
            {
              optionKey: 'new-screen',
              label: 'New screen',
              description: 'Create a dedicated planning screen.',
            },
            {
              optionKey: 'none-of-the-above',
              label: 'None of the above',
              description: 'The right answer is not listed; add a note if needed.',
            },
          ],
          selected_option_key: null,
          answer_note: null,
          is_required: true,
          is_blocking: true,
          status: 'open',
          asked_in_message_id: 32,
          answered_in_message_id: null,
          asked_at: '2026-01-01T00:00:00.000Z',
          answered_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      planArtifact: null,
    });
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(clarifyingDetail);

    mockedCreateOrganizationAiPlanningSession.mockResolvedValue(
      buildPlanningDetail({
        session: {
          id: 15,
          planner_state: 'queued',
          clarification_turn_count: 0,
        },
        messages: [
          {
            id: 31,
            session_id: 15,
            role: 'user',
            message_kind: 'user_input',
            content: 'Plan the planner workflow',
            sequence_number: 1,
            status: 'completed',
            metadata_json: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 32,
            session_id: 15,
            role: 'assistant',
            message_kind: 'planner_status',
            content:
              'Queued the planning run and waiting for the executor to start...',
            sequence_number: 2,
            status: 'pending',
            metadata_json: {
              stage: 'queued',
              userMessageId: 31,
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        planArtifact: null,
      })
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    const textarea = await screen.findByPlaceholderText(
      'Describe the feature, task, or initiative you want planned...'
    );

    fireEvent.change(textarea, {
      target: {
        value: 'Plan the planner workflow',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    await waitFor(() => {
      expect(mockedCreateOrganizationAiPlanningSession).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '7',
        content: 'Plan the planner workflow',
      });
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        '/dashboard/orgs/3/ai?mode=planning&boardId=7&sessionId=15',
        {
          scroll: false,
        }
      );
    });
    expect(
      await screen.findByText(
        'I need one quick decision before I can build a reliable implementation plan.'
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Workspace UI \(Recommended\)/i })
    ).toBeInTheDocument();
  });

  it('submits clarification cards as one structured batch instead of freeform chat', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '15');
    const clarifyingDetail = buildPlanningDetail({
      session: {
        id: 15,
        planner_state: 'clarifying',
        clarification_turn_count: 1,
      },
      messages: [
        {
          id: 32,
          session_id: 15,
          role: 'assistant',
          message_kind: 'clarification_questions',
          content:
            'I need one quick decision before I can build a reliable implementation plan.',
          sequence_number: 2,
          status: 'completed',
          metadata_json: {
            questionKeys: ['scope-board-surface'],
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 4,
          session_id: 15,
          question_key: 'scope-board-surface',
          category: 'scope',
          question_text: 'Which surface should own the planner first?',
          why_this_matters: 'This changes the UX entrypoint.',
          options_json: [
            {
              optionKey: 'workspace-ui',
              label: 'Workspace UI',
              description: 'Keep planning in the existing AI workspace.',
              isRecommended: true,
            },
            {
              optionKey: 'board-view',
              label: 'Board view',
              description: 'Put planning directly on the board.',
            },
            {
              optionKey: 'new-screen',
              label: 'New screen',
              description: 'Create a dedicated planning screen.',
            },
            {
              optionKey: 'none-of-the-above',
              label: 'None of the above',
              description: 'The right answer is not listed; add a note if needed.',
            },
          ],
          selected_option_key: null,
          answer_note: null,
          is_required: true,
          is_blocking: true,
          status: 'open',
          asked_in_message_id: 32,
          answered_in_message_id: null,
          asked_at: '2026-01-01T00:00:00.000Z',
          answered_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      planArtifact: null,
    });
    const clarificationReplyDetail = buildPlanningDetail({
        session: {
          id: 15,
          planner_state: 'queued',
        },
        messages: [
          {
            id: 33,
            session_id: 15,
            role: 'user',
            message_kind: 'user_input',
            content: 'Clarification answers submitted:',
            sequence_number: 3,
            status: 'completed',
            metadata_json: {
              submissionMode: 'clarification_batch',
              answers: [
                {
                  note: 'Keep it in the existing org AI workspace.',
                  questionKey: 'scope-board-surface',
                  questionText: 'Which surface should own the planner first?',
                  selectedOptionKey: 'workspace-ui',
                  selectedOptionLabel: 'Workspace UI',
                },
              ],
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 34,
            session_id: 15,
            role: 'assistant',
            message_kind: 'planner_status',
            content:
              'Queued the planning run and waiting for the executor to start...',
            sequence_number: 4,
            status: 'pending',
            metadata_json: {
              stage: 'queued',
              userMessageId: 33,
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        questions: [
          {
            id: 4,
            session_id: 15,
            question_key: 'scope-board-surface',
            category: 'scope',
            question_text: 'Which surface should own the planner first?',
            why_this_matters: 'This changes the UX entrypoint.',
            options_json: [
              {
                optionKey: 'workspace-ui',
                label: 'Workspace UI',
                description: 'Keep planning in the existing AI workspace.',
                isRecommended: true,
              },
              {
                optionKey: 'board-view',
                label: 'Board view',
                description: 'Put planning directly on the board.',
              },
              {
                optionKey: 'new-screen',
                label: 'New screen',
                description: 'Create a dedicated planning screen.',
              },
              {
                optionKey: 'none-of-the-above',
                label: 'None of the above',
                description: 'The right answer is not listed; add a note if needed.',
              },
            ],
            selected_option_key: 'workspace-ui',
            answer_note: 'Keep it in the existing org AI workspace.',
            is_required: true,
            is_blocking: true,
            status: 'answered',
            asked_in_message_id: 32,
            answered_in_message_id: 33,
            asked_at: '2026-01-01T00:00:00.000Z',
            answered_at: '2026-01-01T00:00:02.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:02.000Z',
          },
        ],
        planArtifact: null,
      });
    const processedDetail = buildPlanningDetail({
      session: {
        id: 15,
        planner_state: 'plan_generated',
      },
      messages: clarificationReplyDetail.messages,
      questions: clarificationReplyDetail.questions,
    });
    mockedFetchOrganizationAiPlanningSession
      .mockResolvedValueOnce(clarifyingDetail)
      .mockResolvedValue(processedDetail);
    mockedCreateOrganizationAiPlanningSessionMessage.mockResolvedValue(
      clarificationReplyDetail
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(
      await screen.findByRole('button', { name: /Workspace UI \(Recommended\)/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Refine the scope or add another planning turn...')
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /Workspace UI \(Recommended\)/i })
    );
    fireEvent.change(screen.getByPlaceholderText('Add extra context if the selected option needs it.'), {
      target: {
        value: 'Keep it in the existing org AI workspace.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit answers/i }));

    await waitFor(() => {
      expect(mockedCreateOrganizationAiPlanningSessionMessage).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '7',
        sessionId: 15,
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'scope-board-surface',
            selectedOptionKey: 'workspace-ui',
            note: 'Keep it in the existing org AI workspace.',
          },
        ],
      });
    });
    expect(
      await screen.findByText('Submitted clarification answer.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Workspace UI (Recommended)')
    ).toBeInTheDocument();
  });

  it('submits clarification cards without notes when the optional note is left blank', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '15');
    const clarifyingDetail = buildPlanningDetail({
      session: {
        id: 15,
        planner_state: 'clarifying',
        clarification_turn_count: 1,
      },
      messages: [
        {
          id: 32,
          session_id: 15,
          role: 'assistant',
          message_kind: 'clarification_questions',
          content:
            'I need one quick decision before I can build a reliable implementation plan.',
          sequence_number: 2,
          status: 'completed',
          metadata_json: {
            questionKeys: ['scope-board-surface'],
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 4,
          session_id: 15,
          question_key: 'scope-board-surface',
          category: 'scope',
          question_text: 'Which surface should own the planner first?',
          why_this_matters: 'This changes the UX entrypoint.',
          options_json: [
            {
              optionKey: 'workspace-ui',
              label: 'Workspace UI',
              description: 'Keep planning in the existing AI workspace.',
              isRecommended: true,
            },
            {
              optionKey: 'board-view',
              label: 'Board view',
              description: 'Put planning directly on the board.',
            },
            {
              optionKey: 'new-screen',
              label: 'New screen',
              description: 'Create a dedicated planning screen.',
            },
            {
              optionKey: 'none-of-the-above',
              label: 'None of the above',
              description: 'The right answer is not listed; add a note if needed.',
            },
          ],
          selected_option_key: null,
          answer_note: null,
          is_required: true,
          is_blocking: true,
          status: 'open',
          asked_in_message_id: 32,
          answered_in_message_id: null,
          asked_at: '2026-01-01T00:00:00.000Z',
          answered_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      planArtifact: null,
    });
    const clarificationReplyDetail = buildPlanningDetail({
      session: {
        id: 15,
        planner_state: 'queued',
      },
      messages: [
        {
          id: 33,
          session_id: 15,
          role: 'user',
          message_kind: 'user_input',
          content: 'Clarification answers submitted:',
          sequence_number: 3,
          status: 'completed',
          metadata_json: {
            submissionMode: 'clarification_batch',
            answers: [
              {
                note: null,
                questionKey: 'scope-board-surface',
                questionText: 'Which surface should own the planner first?',
                selectedOptionKey: 'workspace-ui',
                selectedOptionLabel: 'Workspace UI',
              },
            ],
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 34,
          session_id: 15,
          role: 'assistant',
          message_kind: 'planner_status',
          content:
            'Queued the planning run and waiting for the executor to start...',
          sequence_number: 4,
          status: 'pending',
          metadata_json: {
            stage: 'queued',
            userMessageId: 33,
          },
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 4,
          session_id: 15,
          question_key: 'scope-board-surface',
          category: 'scope',
          question_text: 'Which surface should own the planner first?',
          why_this_matters: 'This changes the UX entrypoint.',
          options_json: [
            {
              optionKey: 'workspace-ui',
              label: 'Workspace UI',
              description: 'Keep planning in the existing AI workspace.',
              isRecommended: true,
            },
            {
              optionKey: 'board-view',
              label: 'Board view',
              description: 'Put planning directly on the board.',
            },
            {
              optionKey: 'new-screen',
              label: 'New screen',
              description: 'Create a dedicated planning screen.',
            },
            {
              optionKey: 'none-of-the-above',
              label: 'None of the above',
              description: 'The right answer is not listed; add a note if needed.',
            },
          ],
          selected_option_key: 'workspace-ui',
          answer_note: null,
          is_required: true,
          is_blocking: true,
          status: 'answered',
          asked_in_message_id: 32,
          answered_in_message_id: 33,
          asked_at: '2026-01-01T00:00:00.000Z',
          answered_at: '2026-01-01T00:00:02.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:02.000Z',
        },
      ],
      planArtifact: null,
    });

    mockedFetchOrganizationAiPlanningSession
      .mockResolvedValueOnce(clarifyingDetail)
      .mockResolvedValue(clarificationReplyDetail);
    mockedCreateOrganizationAiPlanningSessionMessage.mockResolvedValue(
      clarificationReplyDetail
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(
      await screen.findByRole('button', { name: /Workspace UI \(Recommended\)/i })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Workspace UI \(Recommended\)/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /Submit answers/i }));

    await waitFor(() => {
      expect(mockedCreateOrganizationAiPlanningSessionMessage).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '7',
        sessionId: 15,
        mode: 'clarification_batch',
        answers: [
          {
            questionKey: 'scope-board-surface',
            selectedOptionKey: 'workspace-ui',
            note: null,
          },
        ],
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Add extra context if the selected option needs it.')
      ).not.toBeInTheDocument();
    });
  });

  it('hydrates the selected planning session from socket events instead of waiting for polling', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(buildPlanningDetail());

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(
      await screen.findByText('Plan generated.')
    ).toBeInTheDocument();

    planningSocket.trigger(
      'planning:session:updated',
      buildPlanningDetail({
        session: {
          id: 12,
          planner_state: 'failed',
        },
        messages: [
          {
            id: 41,
            session_id: 12,
            role: 'assistant',
            message_kind: 'planner_status',
            content: 'Planning requires GPU-backed Ollama.',
            sequence_number: 3,
            status: 'failed',
            metadata_json: {
              stage: 'analyzing',
              retryable: true,
              userMessageId: 17,
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        planArtifact: null,
      })
    );

    expect(
      await screen.findByText('Planning requires GPU-backed Ollama.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry' })
    ).toBeInTheDocument();
  });

  it('shows planner validation diagnostics in development-like stages', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(
      buildPlanningDetail({
        session: {
          planner_state: 'failed',
        },
        messages: [
          {
            id: 41,
            session_id: 12,
            role: 'assistant',
            message_kind: 'planner_status',
            content: 'Failed to analyze the planning session',
            sequence_number: 3,
            status: 'failed',
            metadata_json: {
              failureCode: 'schema_validation_failed',
              stage: 'analyzing',
              userMessageId: 17,
              validationIssues: [
                'knownRequirements.0: String must contain at most 240 character(s)',
              ],
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        planArtifact: null,
      })
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    expect(
      await screen.findByText('Failed to analyze the planning session')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Failure code: schema_validation_failed')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'knownRequirements.0: String must contain at most 240 character(s)'
      )
    ).toBeInTheDocument();
  });

  it('hides planner validation diagnostics outside development-like stages', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(
      buildPlanningDetail({
        session: {
          planner_state: 'failed',
        },
        messages: [
          {
            id: 41,
            session_id: 12,
            role: 'assistant',
            message_kind: 'planner_status',
            content: 'Failed to analyze the planning session',
            sequence_number: 3,
            status: 'failed',
            metadata_json: {
              failureCode: 'schema_validation_failed',
              stage: 'analyzing',
              userMessageId: 17,
              validationIssues: [
                'knownRequirements.0: String must contain at most 240 character(s)',
              ],
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        planArtifact: null,
      })
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'production',
          provider: 'cloud-stub',
          providerLabel: 'Cloud provider',
          model: 'cloud-pending',
          available: false,
          statusLabel: 'Cloud setup required',
        }}
      />
    );

    expect(
      await screen.findByText('Failed to analyze the planning session')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Failure code: schema_validation_failed')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'knownRequirements.0: String must contain at most 240 character(s)'
      )
    ).not.toBeInTheDocument();
  });

  it('shows a retry action for retryable failed planning turns', async () => {
    const router = createRouterWithSearchSync();
    mockedUseRouter.mockReturnValue(router);
    setSearchParam('mode', 'planning');
    setSearchParam('boardId', '7');
    setSearchParam('sessionId', '12');
    mockedFetchOrganizationAiPlanningSession.mockResolvedValue(
      buildPlanningDetail({
        session: {
          planner_state: 'failed',
        },
        messages: [
          {
            id: 41,
            session_id: 12,
            role: 'assistant',
            message_kind: 'planner_status',
            content: 'Local AI request failed: invalid JSON',
            sequence_number: 3,
            status: 'failed',
            metadata_json: {
              stage: 'analyzing',
              retryable: true,
              userMessageId: 17,
            },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        planArtifact: null,
      })
    );

    renderWithProviders(
      <OrganizationAiWorkspace
        organizationId="3"
        runtime={{
          stage: 'development',
          provider: 'local-ollama',
          providerLabel: 'Local Ollama',
          model: 'qwen2.5-coder:14b',
          available: true,
          statusLabel: 'Configured',
        }}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(mockedProcessOrganizationAiPlanningSession).toHaveBeenCalledWith({
        organizationId: '3',
        boardId: '7',
        sessionId: 12,
      });
    });
  });
});
