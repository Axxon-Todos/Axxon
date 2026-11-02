// Subscribes architecture workspaces to project-scoped revision and run updates.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

export function useProjectRealtime(organizationId: string, projectId: string, socketRef: RefObject<Socket | null>, ready: boolean, hasUnsavedArchitectureDraft = false, onArchitectureConflict?: () => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;
    const refresh = (includeArchitecture = true) => {
      if (includeArchitecture && hasUnsavedArchitectureDraft) {
        // Do not let a remote revision replace the query cache that contains the user's local draft.
        void queryClient.cancelQueries({ queryKey: ['project-architecture', organizationId, projectId] });
        onArchitectureConflict?.();
      } else if (includeArchitecture) {
        queryClient.invalidateQueries({ queryKey: ['project-architecture', organizationId, projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['project-agent-runs', organizationId, projectId] });
      queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
    };
    const onArchitectureUpdated = () => refresh(true);
    const onAgentRunUpdated = () => refresh(true);
    const onCollaborationUpdated = () => refresh(false);
    const onReconnect = () => refresh(true);
    socket.on('architecture:updated', onArchitectureUpdated);
    socket.on('agent:run:updated', onAgentRunUpdated);
    socket.on('project:collaboration:thread.created', onCollaborationUpdated);
    socket.on('project:collaboration:comment.created', onCollaborationUpdated);
    socket.on('project:collaboration:thread.resolved', onCollaborationUpdated);
    socket.on('project:collaboration:thread.reopened', onCollaborationUpdated);
    socket.on('connect', onReconnect);
    return () => { socket.off('architecture:updated', onArchitectureUpdated); socket.off('agent:run:updated', onAgentRunUpdated); socket.off('project:collaboration:thread.created', onCollaborationUpdated); socket.off('project:collaboration:comment.created', onCollaborationUpdated); socket.off('project:collaboration:thread.resolved', onCollaborationUpdated); socket.off('project:collaboration:thread.reopened', onCollaborationUpdated); socket.off('connect', onReconnect); };
  }, [organizationId, projectId, queryClient, socketRef, ready, hasUnsavedArchitectureDraft, onArchitectureConflict]);
}
