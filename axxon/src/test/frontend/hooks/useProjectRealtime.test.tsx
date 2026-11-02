// Verifies architecture realtime refreshes preserve local drafts until the user resolves a conflict.
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';

function setupSocket() {
  // Creates a minimal socket event source for deterministic realtime hook tests.
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)),
    off: vi.fn(),
  };
  return { handlers, socket, socketRef: { current: socket } as unknown as React.RefObject<import('socket.io-client').Socket | null> };
}

function wrapper(queryClient: QueryClient) {
  // Supplies the query client required by the realtime hook under test.
  const QueryWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  QueryWrapper.displayName = 'QueryWrapper';
  return QueryWrapper;
}

describe('useProjectRealtime', () => {
  it('does not invalidate architecture data while a local draft is dirty', () => {
    const queryClient = new QueryClient();
    const { handlers, socketRef } = setupSocket();
    const conflict = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useProjectRealtime('org-1', 'project-1', socketRef, true, true, conflict), { wrapper: wrapper(queryClient) });

    act(() => handlers.get('architecture:updated')?.());

    expect(conflict).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['project-architecture', 'org-1', 'project-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['project-agent-runs', 'org-1', 'project-1'] });
  });

  it('invalidates architecture data when no local draft is dirty', () => {
    const queryClient = new QueryClient();
    const { handlers, socketRef } = setupSocket();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useProjectRealtime('org-1', 'project-1', socketRef, true), { wrapper: wrapper(queryClient) });

    act(() => handlers.get('architecture:updated')?.());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['project-architecture', 'org-1', 'project-1'] });
  });
});
