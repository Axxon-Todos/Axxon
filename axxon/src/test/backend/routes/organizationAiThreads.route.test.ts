// Verifies the org AI thread routes enforce auth wiring for thread list and detail reads.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedListOrganizationAiThreads,
  mockedGetOrganizationAiThread,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedListOrganizationAiThreads: vi.fn(),
  mockedGetOrganizationAiThread: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/ai/organizationAiControllers', () => ({
  listOrganizationAiThreads: mockedListOrganizationAiThreads,
  getOrganizationAiThread: mockedGetOrganizationAiThread,
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

import { GET as getOrganizationAiThreads } from '@/app/api/organizations/[organizationId]/ai/threads/route';
import { GET as getOrganizationAiThread } from '@/app/api/organizations/[organizationId]/ai/threads/[threadId]/route';

describe('organization AI thread routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 21 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('lists the authenticated member thread summaries', async () => {
    mockedListOrganizationAiThreads.mockResolvedValue([
      {
        id: 9,
        organization_id: 3,
        created_by: 21,
        title: 'Sprint planning chat',
        summary: 'Plan the next sprint.',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await getOrganizationAiThreads({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedListOrganizationAiThreads).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 21,
    });
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: 9, title: 'Sprint planning chat' }),
    ]);
  });

  it('returns one persisted thread with its messages', async () => {
    mockedGetOrganizationAiThread.mockResolvedValue({
      thread: {
        id: 9,
        organization_id: 3,
        created_by: 21,
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

    const response = await getOrganizationAiThread({} as never, {
      params: Promise.resolve({ organizationId: '3', threadId: '9' }),
    });

    expect(mockedGetOrganizationAiThread).toHaveBeenCalledWith({
      organizationId: 3,
      threadId: 9,
      sessionUserId: 21,
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        thread: expect.objectContaining({ id: 9 }),
      })
    );
  });
});
