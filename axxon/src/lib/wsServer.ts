// wsServer.ts
import { Server } from "socket.io";
import http from "http";
import Redis from "ioredis";
import { BoardMembers } from '@/lib/models/boardMembers';
import {
  getSessionTokenFromCookieHeader,
  verifySessionToken,
} from '@/lib/utils/auth';

let pub: Redis | null = null;
let sub: Redis | null = null;
let isSubscribed = false;

function createRedisClient(role: 'publisher' | 'subscriber') {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  client.on('error', (error) => {
    console.error(`Redis ${role} error:`, error);
  });
  return client;
}

function getPublisher() {
  if (!pub) {
    pub = createRedisClient('publisher');
  }

  return pub;
}

function getSubscriber() {
  if (!sub) {
    sub = createRedisClient('subscriber');
  }

  return sub;
}

// Initialize WebSocket server with Socket.IO
export function createWsServer(server: http.Server) {

  // Initialize WebSocket server with Socket.IO
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getSessionTokenFromCookieHeader(socket.request.headers.cookie);

      if (!token) {
        console.warn('[WS] Unauthorized handshake rejected: missing token');
        return next(new Error('Unauthorized'));
      }

      const session = await verifySessionToken(token);
      socket.data.userId = session.userId;
      next();
    } catch {
      console.warn('[WS] Unauthorized handshake rejected: invalid or expired token');
      next(new Error('Unauthorized'));
    }
  });

  const subscriber = getSubscriber();

  if (!isSubscribed) {
    isSubscribed = true;

    // Subscribe to all Redis channels
    subscriber.psubscribe("board:*", (err) => {
      if (err) console.error("Redis psubscribe error:", err);
      else console.log("Subscribed to Redis channels: board:*");
    });
  }

  // On Redis publish, forward the message to the correct board room
  subscriber.on("pmessage", (pattern, channel, message) => {
    console.log("🔔 Redis pmessage received:", { pattern, channel, message });

    try {
      const [, boardId] = channel.split(":"); // channel = board:<boardId>
      const parsed = JSON.parse(message);
      const { type, payload } = parsed;

      if (!type) {
        console.warn("⚠️ Redis message missing type field, defaulting to board:update");
        io.to(boardId).emit("board:update", parsed);
        return;
      }

      // Normalize type to colon-separated lowercase
      const normalizedType = type.replace(/([a-z])([A-Z])/g, "$1:$2").toLowerCase();
      const eventName = `board:${normalizedType}`;

      console.log(`➡️ Emitting event "${eventName}" to room ${boardId}`, payload);

      io.to(boardId).emit(eventName, payload);
    } catch (err) {
      console.error("❌ Failed to forward Redis message:", err);
    }
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    let currentBoard: string | null = null;

    // Join a board room (only if different from current)
    socket.on("joinBoard", async (boardId: string) => {
      try {
        const numericBoardId = Number(boardId);

        if (!Number.isFinite(numericBoardId)) {
          socket.emit('socket:error', { error: 'Invalid board id' });
          return;
        }

        const isMember = await BoardMembers.isMember({
          board_id: numericBoardId,
          user_id: Number(socket.data.userId),
        });

        if (!isMember) {
          socket.emit('socket:error', { error: 'Forbidden' });
          return;
        }

        if (currentBoard === String(numericBoardId)) {
          // Already in the desired room, no action
          console.log(`Socket ${socket.id} already in board ${numericBoardId}`);
          return;
        }

        if (currentBoard) {
          socket.leave(currentBoard);
          console.log(`Socket ${socket.id} left previous board ${currentBoard}`);
        }

        socket.join(String(numericBoardId));
        currentBoard = String(numericBoardId);
        console.log(`Socket ${socket.id} joined board ${numericBoardId}`);
      } catch (error) {
        console.error(`Socket ${socket.id} failed to join board ${boardId}:`, error);
        socket.emit('socket:error', { error: 'Failed to join board' });
      }
    });

    // Leave current board explicitly
    socket.on("leaveBoard", () => {
      if (currentBoard) {
        socket.leave(currentBoard);
        console.log(`Socket ${socket.id} left board ${currentBoard}`);
        currentBoard = null;
      }
    });

    // Handle disconnects
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io; // Return the Socket.IO server instance
}

// Helper to publish events into Redis for cross-instance broadcast
export async function publishBoardUpdate(boardId: string, payload: any) {
  console.log(`Publishing update to Redis board:${boardId}`, payload);
  await getPublisher().publish(`board:${boardId}`, JSON.stringify(payload));
}
