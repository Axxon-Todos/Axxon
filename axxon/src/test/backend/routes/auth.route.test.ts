import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const {
  mockedBuildGoogleOAuthAuthorizationUrl,
  mockedHandleApiError,
} = vi.hoisted(() => ({
  mockedBuildGoogleOAuthAuthorizationUrl: vi.fn(),
  mockedHandleApiError: vi.fn(),
}));

vi.mock('@/lib/controllers/auth/authController', () => ({
  buildGoogleOAuthAuthorizationUrl: mockedBuildGoogleOAuthAuthorizationUrl,
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

import { GET } from '@/app/api/auth/google/route';

describe('google auth start route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHandleApiError.mockImplementation((error: unknown) =>
      NextResponse.json({ error: String(error) }, { status: 500 })
    );
  });

  it('redirects the browser to Google OAuth', async () => {
    mockedBuildGoogleOAuthAuthorizationUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?response_type=code'
    );

    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?response_type=code'
    );
  });

  it('passes configuration failures through handleApiError', async () => {
    mockedBuildGoogleOAuthAuthorizationUrl.mockImplementation(() => {
      throw new Error('Missing config');
    });

    const response = await GET();

    expect(mockedHandleApiError).toHaveBeenCalled();
    expect(response.status).toBe(500);
  });
});
