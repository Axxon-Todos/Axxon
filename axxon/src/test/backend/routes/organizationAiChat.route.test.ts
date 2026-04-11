// Verifies the org AI chat route enforces auth wiring and returns the expected NDJSON response contract.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedCreateOrganizationAiChatStream,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedCreateOrganizationAiChatStream: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/ai/organizationAiControllers', () => ({
  createOrganizationAiChatStream: mockedCreateOrganizationAiChatStream,
}));

vi.mock('@/lib/utils/auth', () => ({
  requireSession: mockedRequireSession,
}));

vi.mock('@/lib/utils/apiErrors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/apiErrors')>(
    '@/lib/utils/apiErrors'
  );

  return {
    ...actual,
    handleApiError: mockedHandleApiError,
  };
});

import { POST as organizationAiChatPost } from '@/app/api/organizations/[organizationId]/ai/chat/route';

describe('organization AI chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 21 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
    mockedCreateOrganizationAiChatStream.mockResolvedValue({
      runtime: {
        stage: 'development',
        provider: 'local-ollama',
        providerLabel: 'Local Ollama',
        model: 'qwen2.5-coder:14b',
        available: true,
        statusLabel: 'Configured',
      },
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"type":"done"}\n')
          );
          controller.close();
        },
      }),
    });
  });

  it('streams org-scoped AI chat responses for authenticated users', async () => {
    const response = await organizationAiChatPost(
      {
        json: async () => ({
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedCreateOrganizationAiChatStream).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 21,
      data: {
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('x-axxon-ai-model')).toBe('qwen2.5-coder:14b');
  });

  it('delegates failures to the shared API error handler', async () => {
    mockedRequireSession.mockRejectedValue(new Error('Unauthorized'));

    const response = await organizationAiChatPost(
      {
        json: async () => ({
          messages: [],
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedHandleApiError).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });
});
