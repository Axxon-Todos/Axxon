// Exercises the org AI workspace UI for empty, streaming, and abort-driven chat flows.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedFetchOrganization,
  mockedStreamOrganizationAiChat,
} = vi.hoisted(() => ({
  mockedFetchOrganization: vi.fn(),
  mockedStreamOrganizationAiChat: vi.fn(),
}));

vi.mock('@/lib/api/organizations/getOrganization', () => ({
  fetchOrganization: mockedFetchOrganization,
}));

vi.mock('@/lib/api/organizations/streamOrganizationAiChat', () => ({
  streamOrganizationAiChat: mockedStreamOrganizationAiChat,
}));

import OrganizationAiWorkspace from '@/components/features/organizationAi/OrganizationAiWorkspace';
import { renderWithProviders } from '../renderWithProviders';

describe('OrganizationAiWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });
  });

  it('renders the disabled cloud-stub state when the runtime is unavailable', async () => {
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
  });

  it('streams assistant deltas into the transcript after a user sends a message', async () => {
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
                    delta: 'Hello',
                  }),
                  JSON.stringify({
                    type: 'delta',
                    delta: ' there',
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
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(mockedStreamOrganizationAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '3',
        messages: [
          {
            role: 'user',
            content: 'Summarize the org status',
          },
        ],
      })
    );
  });

  it('aborts the active request when the user stops generation', async () => {
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
