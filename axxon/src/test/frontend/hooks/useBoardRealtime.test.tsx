import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBoardRealtime } from '@/hooks/useBoardRealtime';

type EventHandler = (...args: any[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    on: vi.fn((event: string, handler: EventHandler) => {
      const bucket = handlers.get(event) ?? new Set<EventHandler>();
      bucket.add(handler);
      handlers.set(event, bucket);
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      handlers.get(event)?.delete(handler);
    }),
    emit(event: string, payload: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
  };
}

describe('useBoardRealtime', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  function renderRealtimeHook(socket = createMockSocket()) {
    const socketRef = {
      current: socket as unknown as Socket,
    } as React.RefObject<Socket | null>;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </React.StrictMode>
    );

    const result = renderHook(() => useBoardRealtime('12', '1', socketRef), { wrapper });

    return {
      ...result,
      socket,
    };
  }

  it('registers and cleans up board event listeners', () => {
    const { socket, unmount } = renderRealtimeHook();

    expect(socket.on).toHaveBeenCalledWith(
      'board:todo:created',
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      'board:label:deleted',
      expect.any(Function)
    );
    expect(socket.on).toHaveBeenCalledWith(
      'board:sprint:updated',
      expect.any(Function)
    );

    unmount();

    expect(socket.off).toHaveBeenCalledWith(
      'board:todo:created',
      expect.any(Function)
    );
    expect(socket.off).toHaveBeenCalledWith(
      'board:label:deleted',
      expect.any(Function)
    );
    expect(socket.off).toHaveBeenCalledWith(
      'board:sprint:updated',
      expect.any(Function)
    );
  });

  it('updates todo and label caches from realtime events', () => {
    queryClient.setQueryData(['todos', '12', '1'], [
      {
        id: 1,
        title: 'Original',
        sprint_id: 5,
        sprint: { id: 5, name: 'Sprint 5', color: '#2563eb', icon: 'flag', archived_at: null },
        labels: [{ id: 3, name: 'Backend', color: '#2563eb', board_id: 1 }],
      },
    ]);
    queryClient.setQueryData(['labels', '12', '1'], [
      { id: 3, name: 'Backend', color: '#2563eb', board_id: 1 },
    ]);
    queryClient.setQueryData(['sprints', '12', '1'], [
      { id: 5, name: 'Sprint 5', color: '#2563eb', icon: 'flag', archived_at: null },
    ]);

    const { socket } = renderRealtimeHook();

    socket.emit('board:todo:updated', {
      id: 1,
      title: 'Updated title',
      labels: [{ id: 3, name: 'API', color: '#10b981', board_id: 1 }],
    });
    socket.emit('board:label:updated', {
      id: 3,
      name: 'API',
      color: '#10b981',
      board_id: 1,
    });
    socket.emit('board:sprint:created', {
      id: 6,
      name: 'Sprint 6',
      color: '#f59e0b',
      icon: 'rocket',
      archived_at: null,
    });
    socket.emit('board:sprint:updated', {
      id: 5,
      name: 'Sprint 5 Updated',
      color: '#10b981',
      icon: 'rocket',
      archived_at: null,
    });
    socket.emit('board:todo:deleted', { id: 1 });

    expect(queryClient.getQueryData(['labels', '12', '1'])).toEqual([
      { id: 3, name: 'API', color: '#10b981', board_id: 1 },
    ]);
    expect(queryClient.getQueryData(['sprints', '12', '1'])).toEqual([
      { id: 5, name: 'Sprint 5 Updated', color: '#10b981', icon: 'rocket', archived_at: null },
      { id: 6, name: 'Sprint 6', color: '#f59e0b', icon: 'rocket', archived_at: null },
    ]);
    expect(queryClient.getQueryData(['todos', '12', '1'])).toEqual([]);
  });
});
