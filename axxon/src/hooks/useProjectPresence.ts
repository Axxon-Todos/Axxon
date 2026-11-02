// Publishes project presence and active architecture selections through the authenticated project room.
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

export type ProjectPresence = { componentId?: string | null; relationshipId?: string | null; viewKey?: string | null; status?: 'active' | 'idle' };

export function useProjectPresence(socketRef: RefObject<Socket | null>, ready: boolean, presence: ProjectPresence) {
  const latest = useRef(presence);
  latest.current = presence;
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;
    socket.emit('project:presence', latest.current);
    return () => { socket.emit('project:presence', { ...latest.current, status: 'idle' }); };
  }, [ready, socketRef, presence.componentId, presence.relationshipId, presence.viewKey, presence.status]);
}
