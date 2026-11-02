// Subscribes architecture workspaces to project-scoped revision and run updates.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

export function useProjectRealtime(organizationId: string, projectId: string, socketRef: RefObject<Socket | null>, ready: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['project-architecture', organizationId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-agent-runs', organizationId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
    };
    const onReconnect = () => refresh();
    socket.on('architecture:updated', refresh);
    socket.on('agent:run:updated', refresh);
    socket.on('project:collaboration:thread.created', refresh);
    socket.on('project:collaboration:comment.created', refresh);
    socket.on('project:collaboration:thread.resolved', refresh);
    socket.on('project:collaboration:thread.reopened', refresh);
    socket.on('connect', onReconnect);
    return () => { socket.off('architecture:updated', refresh); socket.off('agent:run:updated', refresh); socket.off('project:collaboration:thread.created', refresh); socket.off('project:collaboration:comment.created', refresh); socket.off('project:collaboration:thread.resolved', refresh); socket.off('project:collaboration:thread.reopened', refresh); socket.off('connect', onReconnect); };
  }, [organizationId, projectId, queryClient, socketRef, ready]);
}
