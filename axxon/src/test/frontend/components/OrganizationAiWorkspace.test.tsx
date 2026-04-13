// Exercises the org AI workspace for persisted thread hydration, streaming, and abort-driven flows.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchOrganization,
  mockedFetchOrganizationAiThreads,
  mockedFetchOrganizationAiThread,
  mockedStreamOrganizationAiChat,
  mockedUsePathname,
  mockedUseRouter,
  mockedUseSearchParams,
} = vi.hoisted(() => ({
  mockedFetchOrganization: vi.fn(),
  mockedFetchOrganizationAiThreads: vi.fn(),
  mockedFetchOrganizationAiThread: vi.fn(),
  mockedStreamOrganizationAiChat: vi.fn(),
  mockedUsePathname: vi.fn(),
  mockedUseRouter: vi.fn(),
  mockedUseSearchParams: vi.fn(),
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

import OrganizationAiWorkspace from '@/components/features/organizationAi/OrganizationAiWorkspace';
import { renderWithProviders } from '../renderWithProviders';

describe('OrganizationAiWorkspace', () => {
  let currentSearchParams: URLSearchParams;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
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
    mockedUsePathname.mockReturnValue('/dashboard/orgs/3/ai');
    mockedUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    });
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

  it('renders the disabled cloud-stub state when the runtime is unavailable', async () => {
    mockedUseRouter.mockReturnValue(createRouterWithSearchSync());

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

    expect(await screen.findByText('Platform AI workspace')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Cloud AI is not configured in this environment yet.')
    ).toBeDisabled();
    expect(
      screen.getByText('Your first message will create a saved thread here.')
    ).toBeInTheDocument();
  });

  it('hydrates a persisted thread from the selected thread id in the URL', async () => {
    mockedFetchOrganizationAiThreads.mockResolvedValue([
      {
        id: 9,
        organization_id: 3,
        created_by: 1,
        title: 'Sprint planning chat',
        summary: 'Plan the next sprint.',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    setSearchParam('threadId', '9');
    mockedUseRouter.mockReturnValue(createRouterWithSearchSync());

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
      await screen.findByRole('heading', { name: 'Sprint planning chat' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Plan the sprint')).toBeInTheDocument();
    expect(mockedFetchOrganizationAiThread).toHaveBeenCalledWith('3', 9);
  });

  it('streams assistant deltas for a new persisted thread and updates the thread id in the URL', async () => {
    const router = createRouterWithSearchSync();

    mockedUseRouter.mockReturnValue(router);
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

    const textarea = await screen.findByPlaceholderText(
      'Ask Axxon AI about planning, execution, or the next MVP step...'
    );

    fireEvent.change(textarea, {
      target: {
        value: 'Summarize the org status',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    expect(await screen.findByText('You')).toBeInTheDocument();
    expect(await screen.findByText('Axxon AI')).toBeInTheDocument();
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(mockedStreamOrganizationAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '3',
        content: 'Summarize the org status',
        threadId: undefined,
      })
    );
    expect(router.replace).toHaveBeenCalledWith('/dashboard/orgs/3/ai?threadId=44', {
      scroll: false,
    });
  });

  it('aborts the active request when the user stops generation', async () => {
    mockedUseRouter.mockReturnValue(createRouterWithSearchSync());
    mockedStreamOrganizationAiChat.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
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
      'Ask Axxon AI about planning, execution, or the next MVP step...'
    );

    fireEvent.change(textarea, {
      target: {
        value: 'Keep streaming',
      },
    });
    fireEvent.submit(textarea.closest('form')!);

    const stopButton = await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });
  });
});
