import React, { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type EventHandler = (...args: any[]) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    id: 'socket-1',
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
});
