// Publishes the current architecture selection to collaborators without changing canonical graph state.
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

export function useProjectSelection(socketRef: RefObject<Socket | null>, ready: boolean, selection: { componentId?: string | null; relationshipId?: string | null; viewKey?: string | null }) {
  const { componentId, relationshipId, viewKey } = selection;
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;
    socket.emit('project:selection', { componentId, relationshipId, viewKey });
  }, [componentId, ready, relationshipId, socketRef, viewKey]);
}
