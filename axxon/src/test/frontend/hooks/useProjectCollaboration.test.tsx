// Verifies project presence publishing remains scoped to the authenticated project socket.
import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useProjectPresence } from '@/hooks/useProjectPresence';

describe('useProjectPresence', () => {
  it('publishes selection presence and marks it idle on cleanup', () => {
    const socket = { emit: vi.fn() } as unknown as Socket;
    const socketRef = { current: socket } as React.RefObject<Socket | null>;
    const { unmount } = renderHook(() => useProjectPresence(socketRef, true, { componentId: 'api', viewKey: 'backend', status: 'active' }));

    expect(socket.emit).toHaveBeenCalledWith('project:presence', { componentId: 'api', viewKey: 'backend', status: 'active' });
    unmount();
    expect(socket.emit).toHaveBeenCalledWith('project:presence', { componentId: 'api', viewKey: 'backend', status: 'idle' });
  });
});
