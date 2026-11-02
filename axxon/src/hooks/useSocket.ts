// Manages a shared authenticated Socket.IO client and optional board-room membership for realtime UI updates.
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(boardId: string | null, projectId: string | null = null) {
  const socketRef = useRef<Socket | null>(null);
  const currentBoardRef = useRef<string | null>(null);
  const currentProjectRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // Create socket once
  useEffect(() => {
    if (!socketRef.current) {
      const socket = io(process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000", {
        transports: ["websocket"],
        withCredentials: true,
        reconnectionAttempts: 5,
      });

      socket.on("connect", () => {
        console.log(`Socket connected: ${socket.id}`);

        // Rejoin the active board after reconnects.
        if (currentBoardRef.current) {
          socket.emit("joinBoard", currentBoardRef.current);
        }
        if (currentProjectRef.current) {
          socket.emit("joinProject", currentProjectRef.current);
        }
      });

      socket.on("connect_error", (error) => {
        if (error.message === "Unauthorized") {
          console.warn("Socket authentication failed. Stopping reconnect attempts.");
          socket.io.opts.reconnection = false;
          socket.disconnect();
          return;
        }

        console.warn("Socket connection error:", error.message);
      });

      socketRef.current = socket;
      setReady(true);
    }

    return () => {
      // Disconnect only on unmount.
      socketRef.current?.disconnect();
      socketRef.current = null;
      currentBoardRef.current = null;
      currentProjectRef.current = null;
      setReady(false);
    };
  }, []);

  // Keep board room membership in one place to avoid duplicate joins.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (!boardId) {
      if (currentBoardRef.current) {
        socket.emit("leaveBoard", currentBoardRef.current);
        console.log(`Left board ${currentBoardRef.current}`);
        currentBoardRef.current = null;
      }

      return;
    }

    if (currentBoardRef.current === boardId) return;

    if (currentBoardRef.current) {
      socket.emit("leaveBoard", currentBoardRef.current);
      console.log(`Left board ${currentBoardRef.current}`);
    }

    socket.emit("joinBoard", boardId);
    console.log(`Joined board ${boardId}`);

    currentBoardRef.current = boardId;
  }, [boardId, ready]);

  // Keep project room membership separate from board membership for project-scoped realtime updates.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (currentProjectRef.current && currentProjectRef.current !== projectId) socket.emit('leaveProject');
    if (projectId && currentProjectRef.current !== projectId) socket.emit('joinProject', projectId);
    currentProjectRef.current = projectId;
    return () => {
      if (currentProjectRef.current === projectId && projectId) socket.emit('leaveProject');
    };
  }, [projectId, ready]);

  return { socketRef, ready };
}
