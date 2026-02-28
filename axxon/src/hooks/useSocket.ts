import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(boardId: string) {
  const socketRef = useRef<Socket | null>(null);
  const currentBoardRef = useRef<string | null>(null);

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
    }

    return () => {
      // Disconnect only on unmount.
      socketRef.current?.disconnect();
      socketRef.current = null;
      currentBoardRef.current = null;
    };
  }, []);

  // Keep board room membership in one place to avoid duplicate joins.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (currentBoardRef.current === boardId) return;

    if (currentBoardRef.current) {
      socket.emit("leaveBoard", currentBoardRef.current);
      console.log(`Left board ${currentBoardRef.current}`);
    }

    socket.emit("joinBoard", boardId);
    console.log(`Joined board ${boardId}`);

    currentBoardRef.current = boardId;
  }, [boardId]);

  return socketRef;
}
