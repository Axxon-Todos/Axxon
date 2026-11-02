// Verifies project collaborator snapshots and live selection updates are rendered from socket events.
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aggregateProjectCollaborators, useProjectCollaborationState } from '@/hooks/useProjectCollaborationState';

describe('useProjectCollaborationState', () => {
  it('aggregates duplicate socket sessions by user and keeps active presence', () => {
    expect(aggregateProjectCollaborators([
      { socketId: 'old', userId: 7, componentId: 'api', relationshipId: null, viewKey: 'backend', status: 'idle' },
      { socketId: 'new', userId: 7, componentId: 'db', relationshipId: null, viewKey: 'data', status: 'active' },
    ])).toEqual([{ socketId: 'new', userId: 7, componentId: 'db', relationshipId: null, viewKey: 'data', status: 'active' }]);
  });

  it('hydrates a snapshot and updates active selections', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const socket = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)),
      off: vi.fn(),
    };
    const socketRef = { current: socket } as unknown as React.RefObject<import('socket.io-client').Socket | null>;
    const { result } = renderHook(() => useProjectCollaborationState(socketRef, true, 'project-1'));

    act(() => handlers.get('project:presence:snapshot')?.([{ userId: 7, componentId: 'api', viewKey: 'backend', status: 'active' }]));
    expect(result.current).toEqual([{ socketId: 'user:7', userId: 7, componentId: 'api', relationshipId: null, viewKey: 'backend', status: 'active' }]);

    act(() => handlers.get('project:selection:updated')?.({ userId: 7, relationshipId: 'edge-1', viewKey: 'security' }));
    expect(result.current[0]).toMatchObject({ userId: 7, componentId: null, relationshipId: 'edge-1', viewKey: 'security' });
  });
});
