import type { NextRequest } from 'next/server';
import { BadRequestError } from '@/lib/utils/apiErrors';

export type RouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>;
};

// invalid params guard
export function parseNumericRouteParam(value: string, label: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new BadRequestError(`Invalid ${label}`);
  }

  return parsedValue;
}

// common bad req
export async function parseJsonBody<T>(req: Pick<NextRequest, 'json'>): Promise<T> {
  try {
    const body = await req.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestError('Request body must be a JSON object');
    }

    return body as T;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    throw new BadRequestError('Invalid JSON body');
  }
}
