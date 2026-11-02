// Subscribes to project presence and selection events and exposes current collaborator state.
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

export type ProjectCollaborator = {
  socketId: string;
  userId: number;
  componentId: string | null;
  relationshipId: string | null;
  viewKey: string | null;
  status: 'active' | 'idle';
};

function normalizeCollaborator(value: Record<string, unknown>): ProjectCollaborator | null {
  // Converts an untrusted realtime payload into the shape rendered by the workspace.
  const userId = Number(value.userId);
  if (!Number.isFinite(userId)) return null;
  return {
    socketId: typeof value.socketId === 'string' ? value.socketId : `user:${userId}`,
    userId,
    componentId: typeof value.componentId === 'string' ? value.componentId : null,
    relationshipId: typeof value.relationshipId === 'string' ? value.relationshipId : null,
    viewKey: typeof value.viewKey === 'string' ? value.viewKey : null,
    status: value.status === 'idle' ? 'idle' : 'active',
  };
}

// Collapses multiple socket sessions for one user without allowing an idle session to hide an active one.
export function aggregateProjectCollaborators(entries: ProjectCollaborator[]) {
  const byUser = new Map<number, ProjectCollaborator>();
  for (const entry of entries) {
    const current = byUser.get(entry.userId);
    if (!current || (entry.status === 'active' && current.status === 'idle')) byUser.set(entry.userId, entry);
    else if (entry.status === current.status) byUser.set(entry.userId, entry);
  }
  return [...byUser.values()];
}

// Keeps collaborator presence and active selections synchronized with the joined project room.
export function useProjectCollaborationState(socketRef: RefObject<Socket | null>, ready: boolean, projectId: string | null = null) {
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready || !projectId) {
      setCollaborators([]);
      return;
    }
    setCollaborators([]);

    const onSnapshot = (payload: unknown) => {
      const next = Array.isArray(payload)
        ? payload.map((entry) => normalizeCollaborator((entry || {}) as Record<string, unknown>)).filter((entry): entry is ProjectCollaborator => Boolean(entry))
        : [];
      setCollaborators(aggregateProjectCollaborators(next));
    };
    const onPresence = (payload: unknown) => {
      const collaborator = normalizeCollaborator((payload || {}) as Record<string, unknown>);
      if (!collaborator) return;
      setCollaborators((current) => aggregateProjectCollaborators(collaborator.status === 'idle'
        ? current.filter((entry) => entry.socketId !== collaborator.socketId)
        : [...current.filter((entry) => entry.socketId !== collaborator.socketId), collaborator]));
    };
    const onSelection = (payload: unknown) => {
      const selection = (payload || {}) as Record<string, unknown>;
      const userId = Number(selection.userId);
      if (!Number.isFinite(userId)) return;
      const socketId = typeof selection.socketId === 'string' ? selection.socketId : `user:${userId}`;
      setCollaborators((current) => {
        const existing = current.find((entry) => entry.socketId === socketId);
        const next: ProjectCollaborator = {
          socketId,
          userId,
          componentId: typeof selection.componentId === 'string' ? selection.componentId : null,
          relationshipId: typeof selection.relationshipId === 'string' ? selection.relationshipId : null,
          viewKey: typeof selection.viewKey === 'string' ? selection.viewKey : null,
          status: existing?.status || 'active',
        };
        return aggregateProjectCollaborators([...current.filter((entry) => entry.socketId !== socketId), next]);
      });
    };

    socket.on('project:presence:snapshot', onSnapshot);
    socket.on('project:presence:updated', onPresence);
    socket.on('project:selection:updated', onSelection);
    return () => {
      socket.off('project:presence:snapshot', onSnapshot);
      socket.off('project:presence:updated', onPresence);
      socket.off('project:selection:updated', onSelection);
    };
  }, [projectId, ready, socketRef]);

  return collaborators;
}
