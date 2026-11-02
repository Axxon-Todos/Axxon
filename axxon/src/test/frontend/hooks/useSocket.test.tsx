// Verifies the shared socket hook handles board membership changes and idle AI-workspace connections.
import React, { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type EventHandler = (...args: any[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    id: 'socket-1',
    connected: true,
    io: {
      opts: {
        reconnection: true,
      },
    },
    on: vi.fn((event: string, handler: EventHandler) => {
      const bucket = handlers.get(event) ?? new Set<EventHandler>();
      bucket.add(handler);
      handlers.set(event, bucket);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

const { mockedIo } = vi.hoisted(() => ({
  mockedIo: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: mockedIo,
}));

import { useSocket } from '@/hooks/useSocket';

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins and leaves board rooms when the board id changes', () => {
    const socket = createMockSocket();
    mockedIo.mockReturnValue(socket);

    const { rerender, unmount } = renderHook(({ boardId }: { boardId: string }) => useSocket(boardId), {
      initialProps: { boardId: 'board-1' },
      wrapper: ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    rerender({ boardId: 'board-2' });
    unmount();

    expect(socket.emit).toHaveBeenCalledWith('joinBoard', 'board-1');
    expect(socket.emit).toHaveBeenCalledWith('leaveBoard', 'board-1');
    expect(socket.emit).toHaveBeenCalledWith('joinBoard', 'board-2');
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('disables reconnection after unauthorized connect errors', () => {
    const socket = createMockSocket();
    mockedIo.mockReturnValue(socket);

    renderHook(() => useSocket('board-1'), {
      wrapper: ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    socket.trigger('connect_error', new Error('Unauthorized'));

    expect(socket.io.opts.reconnection).toBe(false);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('rejoins the active board after reconnecting', () => {
    const socket = createMockSocket();
    mockedIo.mockReturnValue(socket);

    renderHook(() => useSocket('board-99'), {
      wrapper: ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    socket.trigger('connect');

    expect(socket.emit).toHaveBeenCalledWith('joinBoard', 'board-99');
  });

  it('does not report a project room as ready until the join acknowledgement succeeds', () => {
    const socket = createMockSocket();
    mockedIo.mockReturnValue(socket);

    const { result } = renderHook(() => useSocket(null, 'project-7'));
    expect(result.current.projectReady).toBe(false);

    socket.trigger('connect');
    const joinCall = socket.emit.mock.calls.find(([event]) => event === 'joinProject');
    expect(joinCall?.[1]).toBe('project-7');
    expect(typeof joinCall?.[2]).toBe('function');

    act(() => (joinCall?.[2] as (result: { ok: boolean }) => void)({ ok: true }));
    expect(result.current.projectReady).toBe(true);

    act(() => socket.trigger('disconnect'));
    expect(result.current.projectReady).toBe(false);

    act(() => socket.trigger('connect'));
    expect(socket.emit.mock.calls.filter(([event]) => event === 'joinProject').length).toBeGreaterThanOrEqual(2);
  });

  it('connects without joining a board room when no board id is active', () => {
    const socket = createMockSocket();
    mockedIo.mockReturnValue(socket);

    renderHook(() => useSocket(null), {
      wrapper: ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    expect(socket.emit).not.toHaveBeenCalledWith('joinBoard', expect.anything());
  });
});
