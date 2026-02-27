// hooks/useBoardRealtime.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import type { RefObject } from "react";
import type { LabelBaseData } from "@/lib/types/labelTypes";

export function useBoardRealtime(boardId: string, socketRef: RefObject<Socket | null>) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let currentBoard = boardId;

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

    // --- Listen for all board events ---
    socket.on("board:todo:created", handleTodoCreated);
    socket.on("board:todo:updated", handleTodoUpdated);
    socket.on("board:todo:deleted", handleTodoDeleted);
    socket.on("board:label:created", handleLabelCreated);
    socket.on("board:label:updated", handleLabelUpdated);
    socket.on("board:label:deleted", handleLabelDeleted);

    // --- Join the board ---
    socket.emit("joinBoard", boardId);

    // --- Handle boardId changes (switching boards) ---
    const prevBoard = currentBoard;
    currentBoard = boardId;
    if (prevBoard !== currentBoard) {
      socket.emit("leaveBoard", prevBoard);
      socket.emit("joinBoard", currentBoard);
    }

    // --- Cleanup ---
    return () => {
      socket.off("board:todo:created", handleTodoCreated);
      socket.off("board:todo:updated", handleTodoUpdated);
      socket.off("board:todo:deleted", handleTodoDeleted);
      socket.off("board:label:created", handleLabelCreated);
      socket.off("board:label:updated", handleLabelUpdated);
      socket.off("board:label:deleted", handleLabelDeleted);
      socket.emit("leaveBoard", currentBoard);
    };
  }, [boardId, queryClient, socketRef]);
}
