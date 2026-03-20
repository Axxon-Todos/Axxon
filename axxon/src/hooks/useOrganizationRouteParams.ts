'use client';

import { useParams } from 'next/navigation';

function normalizeRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function useOrganizationRouteParams() {
  const params =
    useParams<{
      organizationId?: string | string[];
      boardId?: string | string[];
    }>() ?? {}

  return {
    organizationId: normalizeRouteParam(params.organizationId),
    boardId: normalizeRouteParam(params.boardId),
  };
}
