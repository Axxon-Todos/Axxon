// hooks/useBoardRealtime.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import type { RefObject } from "react";
import type { LabelBaseData } from "@/lib/types/labelTypes";
import type { SprintBaseData } from "@/lib/types/sprintTypes";

export function useBoardRealtime(boardId: string, socketRef: RefObject<Socket | null>) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const currentBoard = boardId;

    // --- Event handlers ---
    const handleTodoCreated = (todo: any) => {
      console.log("Realtime todo created received:", todo);
      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? [...old, todo] : [todo]
      );
    };

    const handleTodoUpdated = (todo: any) => {
      console.log("Realtime todo updated received:", todo);
      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? old.map(t => (t.id === todo.id ? todo : t)) : [todo]
      );
    };

    const handleTodoDeleted = ({ id }: any) => {
      console.log("Realtime todo deleted received:", id);
      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? old.filter(t => t.id !== id) : []
      );
    };

    const handleLabelCreated = (label: LabelBaseData) => {
      console.log("Realtime label created received:", label);
      queryClient.setQueryData(["labels", currentBoard], (old: LabelBaseData[]) =>
        old ? [...old, label] : [label]
      );
    };

    const handleLabelUpdated = (label: LabelBaseData) => {
      console.log("Realtime label updated received:", label);
      queryClient.setQueryData(["labels", currentBoard], (old: LabelBaseData[]) =>
        old ? old.map(l => (l.id === label.id ? label : l)) : [label]
      );

      // Update todos that have this label
      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? old.map(todo => ({
          ...todo,
          labels: todo.labels?.map((l: any) => l.id === label.id ? label : l)
        })) : []
      );
    };

    const handleLabelDeleted = ({ id }: { id: number }) => {
      console.log("Realtime label deleted received:", id);
      queryClient.setQueryData(["labels", currentBoard], (old: LabelBaseData[]) =>
        old ? old.filter(l => l.id !== id) : []
      );

      // Remove from all todos
      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? old.map(todo => ({
          ...todo,
          labels: todo.labels?.filter((l: any) => l.id !== id)
        })) : []
      );
    };

    const handleSprintCreated = (sprint: SprintBaseData) => {
      console.log("Realtime sprint created received:", sprint);
      queryClient.setQueryData(["sprints", currentBoard], (old: SprintBaseData[]) =>
        old ? [...old, sprint] : [sprint]
      );
    };

    const handleSprintUpdated = (sprint: SprintBaseData) => {
      console.log("Realtime sprint updated received:", sprint);
      queryClient.setQueryData(["sprints", currentBoard], (old: SprintBaseData[]) =>
        old ? old.map(item => (item.id === sprint.id ? sprint : item)) : [sprint]
      );

      queryClient.setQueryData(["todos", currentBoard], (old: any[]) =>
        old ? old.map(todo => (
          todo.sprint_id === sprint.id
            ? {
                ...todo,
                sprint: {
                  id: sprint.id,
                  name: sprint.name,
                  color: sprint.color,
                  icon: sprint.icon,
                  archived_at: sprint.archived_at,
                },
              }
            : todo
        )) : []
      );
    };

    // --- Listen for all board events ---
    socket.on("board:todo:created", handleTodoCreated);
    socket.on("board:todo:updated", handleTodoUpdated);
    socket.on("board:todo:deleted", handleTodoDeleted);
    socket.on("board:label:created", handleLabelCreated);
    socket.on("board:label:updated", handleLabelUpdated);
    socket.on("board:label:deleted", handleLabelDeleted);
    socket.on("board:sprint:created", handleSprintCreated);
    socket.on("board:sprint:updated", handleSprintUpdated);

    // --- Cleanup ---
    return () => {
      socket.off("board:todo:created", handleTodoCreated);
      socket.off("board:todo:updated", handleTodoUpdated);
      socket.off("board:todo:deleted", handleTodoDeleted);
      socket.off("board:label:created", handleLabelCreated);
      socket.off("board:label:updated", handleLabelUpdated);
      socket.off("board:label:deleted", handleLabelDeleted);
      socket.off("board:sprint:created", handleSprintCreated);
      socket.off("board:sprint:updated", handleSprintUpdated);
    };
  }, [boardId, queryClient, socketRef]);
}
