// Keeps agent-run React Query caches aligned with board-scoped Socket.IO updates.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { AgentRun, AgentRunDetail } from '@/lib/types/agentTypes';

type AgentRunUpdatePayload = {
  run?: AgentRun;
};

export function useAgentRunsRealtime(
  organizationId: string,
  boardId: string | null,
  socketRef: RefObject<Socket | null>
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !organizationId || !boardId) return;

    const runsKey = ['agent-runs', organizationId, boardId];

    const handleRunUpdated = ({ run }: AgentRunUpdatePayload) => {
      if (!run) return;

      queryClient.setQueryData(runsKey, (current: AgentRun[] | undefined) => {
        if (!current) return [run];
        const hasRun = current.some((item) => item.id === run.id);
        const nextRuns = hasRun
          ? current.map((item) => (item.id === run.id ? run : item))
          : [run, ...current];

        return nextRuns.sort((left, right) => {
          const leftUpdatedAt = new Date(left.updatedAt).getTime();
          const rightUpdatedAt = new Date(right.updatedAt).getTime();
          return rightUpdatedAt - leftUpdatedAt || right.id - left.id;
        });
      });

      const detailKey = ['agent-run', organizationId, boardId, run.id];
      queryClient.setQueryData(detailKey, (current: AgentRunDetail | undefined) =>
        current ? { ...current, ...run } : current
      );
      queryClient.invalidateQueries({ queryKey: detailKey });
    };

    socket.on('board:agent:run:updated', handleRunUpdated);

    return () => {
      socket.off('board:agent:run:updated', handleRunUpdated);
    };
  }, [boardId, organizationId, queryClient, socketRef]);
}
