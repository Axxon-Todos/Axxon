import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedGetOrganization,
  mockedUpdateOrganization,
  mockedRequireSession,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedGetOrganization: vi.fn(),
  mockedUpdateOrganization: vi.fn(),
  mockedRequireSession: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/organizations/organizationControllers', () => ({
  getOrganization: mockedGetOrganization,
  updateOrganization: mockedUpdateOrganization,
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

import { GET, PATCH } from '@/app/api/organizations/[organizationId]/route';

describe('organization route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireSession.mockResolvedValue({ userId: 17 });
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('returns updated organizations from PATCH', async () => {
    mockedUpdateOrganization.mockResolvedValue({ id: 3, name: 'Platform' });

    const response = await PATCH(
      {
        json: async () => ({
          name: 'Platform',
          description: 'Updated',
          color: '#0f766e',
        }),
      } as never,
      {
        params: Promise.resolve({ organizationId: '3' }),
      }
    );

    expect(mockedRequireSession).toHaveBeenCalled();
    expect(mockedUpdateOrganization).toHaveBeenCalledWith({
      organizationId: 3,
      sessionUserId: 17,
      data: {
        name: 'Platform',
        description: 'Updated',
        color: '#0f766e',
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 3, name: 'Platform' });
  });

  it('passes route errors through handleApiError', async () => {
    mockedGetOrganization.mockRejectedValue(new Error('boom'));

    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: '3' }),
    });

    expect(mockedHandleApiError).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });
});
