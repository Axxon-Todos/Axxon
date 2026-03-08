import { describe, expect, it } from 'vitest';

import { ApiError, BadRequestError, handleApiError } from '@/lib/utils/apiErrors';

describe('apiErrors', () => {
  it('maps known ApiError instances to their HTTP response', async () => {
    const response = handleApiError(
      new BadRequestError('Invalid payload'),
      '[TEST_ERROR]',
      'fallback'
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid payload' });
  });

  it('maps raw unauthorized errors to 401', async () => {
    const response = handleApiError(new Error('Unauthorized'), '[TEST_ERROR]', 'fallback');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('uses the fallback message for unknown errors', async () => {
    const response = handleApiError(new Error('Unexpected'), '[TEST_ERROR]', 'fallback');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'fallback' });
  });

  it('retains the shared ApiError base class shape', () => {
    const error = new ApiError(418, 'teapot');

    expect(error.status).toBe(418);
    expect(error.message).toBe('teapot');
  });
});
