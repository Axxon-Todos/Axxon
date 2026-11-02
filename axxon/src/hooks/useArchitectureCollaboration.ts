// Coordinates architecture discussion queries, realtime invalidation, and reconnect event backfill.
import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { fetchArchitectureCollaborationEvents, fetchArchitectureThreads } from '@/lib/api/projects/collaboration';

export function useArchitectureCollaboration(organizationId: string, projectId: string, socketRef: RefObject<Socket | null>, ready: boolean) {
  const queryClient = useQueryClient();
  const cursorRef = useRef(0);
  const threadsQuery = useQuery({ queryKey: ['architecture-threads', organizationId, projectId], queryFn: () => fetchArchitectureThreads(organizationId, projectId), enabled: Boolean(organizationId && projectId) });

  const refresh = useCallback(async () => {
    const events = await fetchArchitectureCollaborationEvents(organizationId, projectId, cursorRef.current).catch(() => []);
    if (events.length) {
      cursorRef.current = Math.max(...events.map((event) => event.id));
      await queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
    } else {
      await queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
    }
  }, [organizationId, projectId, queryClient]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !ready) return;
    const onCollaboration = (payload: { eventId?: number }) => {
      if (payload?.eventId) cursorRef.current = Math.max(cursorRef.current, payload.eventId);
      void queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
    };
    const onConnect = () => void refresh();
    socket.on('project:collaboration:thread.created', onCollaboration);
    socket.on('project:collaboration:comment.created', onCollaboration);
    socket.on('project:collaboration:thread.resolved', onCollaboration);
    socket.on('project:collaboration:thread.reopened', onCollaboration);
    socket.on('project:collaboration:agent.run.created', onCollaboration);
    socket.on('connect', onConnect);
    return () => {
      socket.off('project:collaboration:thread.created', onCollaboration);
      socket.off('project:collaboration:comment.created', onCollaboration);
      socket.off('project:collaboration:thread.resolved', onCollaboration);
      socket.off('project:collaboration:thread.reopened', onCollaboration);
      socket.off('project:collaboration:agent.run.created', onCollaboration);
      socket.off('connect', onConnect);
    };
  }, [organizationId, projectId, queryClient, ready, refresh, socketRef]);

  return { threads: threadsQuery.data || [], isLoading: threadsQuery.isLoading, isError: threadsQuery.isError, refresh };
}
