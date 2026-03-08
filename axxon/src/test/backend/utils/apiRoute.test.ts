import { describe, expect, it } from 'vitest';

import { BadRequestError } from '@/lib/utils/apiErrors';
import { parseJsonBody, parseNumericRouteParam } from '@/lib/utils/apiRoute';

describe('apiRoute utils', () => {
  it('parses numeric route params', () => {
    expect(parseNumericRouteParam('42', 'board id')).toBe(42);
    expect(() => parseNumericRouteParam('abc', 'board id')).toThrow(BadRequestError);
  });

  it('rejects non-object JSON bodies', async () => {
    await expect(
      parseJsonBody({
        json: async () => ['invalid'],
      } as never)
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('returns object JSON bodies', async () => {
    await expect(
      parseJsonBody<{ name: string }>({
        json: async () => ({ name: 'valid' }),
      } as never)
    ).resolves.toEqual({ name: 'valid' });
  });
});
