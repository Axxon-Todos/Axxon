// Hosts authenticated Socket.IO rooms for board-scoped realtime updates and private user-scoped events.
import { Server } from "socket.io";
import http from "http";
import Redis from "ioredis";
import {
  getConfiguredClientOrigins,
  getRedisUrl,
} from '@/lib/env/connectionConfig';
import { BoardMembers } from '@/lib/models/boardMembers';
import {
  getSessionTokenFromCookieHeader,
  verifySessionToken,
} from '@/lib/utils/auth';

let pub: Redis | null = null;
let sub: Redis | null = null;
let isSubscribed = false;
let isRedisForwarderRegistered = false;
const activeIoServers = new Set<Server>();
const unauthorizedHandshakeAttempts = new Map<
  string,
  {
    blockedUntil: number;
    count: number;
    windowStartedAt: number;
  }
>();
const SOCKET_HANDSHAKE_WINDOW_MS = 60_000;
const SOCKET_HANDSHAKE_BLOCK_MS = 60_000;
const SOCKET_HANDSHAKE_MAX_FAILURES = 10;
const SOCKET_MAX_HTTP_BUFFER_SIZE_BYTES = 1_000_000;

function getAllowedSocketOrigins() {
  return getConfiguredClientOrigins();
}

function isAllowedSocketOrigin(origin?: string | null) {
  if (!origin) {
    return true;
  }

  return getAllowedSocketOrigins().includes(origin);
}

function getSocketClientKey(request: http.IncomingMessage) {
  const forwardedFor = request.headers['x-forwarded-for'];
  const firstForwardedAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];

  return firstForwardedAddress?.trim() || request.socket.remoteAddress || 'unknown';
}

function registerUnauthorizedHandshake(clientKey: string) {
  const now = Date.now();
  const currentAttempt = unauthorizedHandshakeAttempts.get(clientKey);

  if ((currentAttempt?.blockedUntil ?? 0) > now) {
    return true;
  }

  const nextAttempt =
    currentAttempt && now - currentAttempt.windowStartedAt < SOCKET_HANDSHAKE_WINDOW_MS
      ? {
          blockedUntil: currentAttempt.blockedUntil,
          count: currentAttempt.count + 1,
          windowStartedAt: currentAttempt.windowStartedAt,
        }
      : {
          blockedUntil: 0,
          count: 1,
          windowStartedAt: now,
        };

  if (nextAttempt.count >= SOCKET_HANDSHAKE_MAX_FAILURES) {
    nextAttempt.blockedUntil = now + SOCKET_HANDSHAKE_BLOCK_MS;
  }

  unauthorizedHandshakeAttempts.set(clientKey, nextAttempt);

  return nextAttempt.blockedUntil > now;
}

function clearUnauthorizedHandshake(clientKey: string) {
  unauthorizedHandshakeAttempts.delete(clientKey);
}

function createRedisClient(role: 'publisher' | 'subscriber') {
  const client = new Redis(getRedisUrl());
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

function emitRedisScopedMessage(channel: string, message: string) {
  try {
    const [scope, targetId] = channel.split(":");
    const parsed = JSON.parse(message);
    const { type, payload } = parsed;

    if (!scope || !targetId) {
      console.warn("Redis message had an invalid scoped channel:", channel);
      return;
    }

    if (!type) {
      const fallbackEventName = `${scope}:update`;
      const roomName = scope === 'board' ? targetId : `${scope}:${targetId}`;

      console.warn(
        `Redis message missing type field, defaulting to ${fallbackEventName}`
      );
      for (const io of activeIoServers) {
        io.to(roomName).emit(fallbackEventName, parsed);
      }
      return;
    }

    const normalizedType = type.replace(/([a-z])([A-Z])/g, "$1:$2").toLowerCase();
    const roomName = scope === 'board' ? targetId : `${scope}:${targetId}`;
    const eventName = scope === 'board' ? `board:${normalizedType}` : normalizedType;

    for (const io of activeIoServers) {
      io.to(roomName).emit(eventName, payload);
    }
  } catch (error) {
    console.error("Failed to forward Redis message:", error);
  }
}

// Initialize WebSocket server with Socket.IO
export function createWsServer(server: http.Server) {

  // Initialize WebSocket server with Socket.IO
  const io = new Server(server, {
    allowRequest: (req, callback) => {
      if (!isAllowedSocketOrigin(req.headers.origin)) {
        callback('Forbidden origin', false);
        return;
      }

      callback(null, true);
    },
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE_BYTES,
    cors: {
      origin: getAllowedSocketOrigins(),
      credentials: true,
      methods: ["GET", "POST"],
    },
  });
  activeIoServers.add(io);

  io.use(async (socket, next) => {
    const clientKey = getSocketClientKey(socket.request);

    try {
      const token = getSessionTokenFromCookieHeader(socket.request.headers.cookie);

      if (!token) {
        console.warn('[WS] Unauthorized handshake rejected: missing token');
        if (registerUnauthorizedHandshake(clientKey)) {
          return next(new Error('Too many requests'));
        }
        return next(new Error('Unauthorized'));
      }

      const session = await verifySessionToken(token);
      clearUnauthorizedHandshake(clientKey);
      socket.data.userId = session.userId;
      socket.data.clientKey = clientKey;
      next();
    } catch {
      console.warn('[WS] Unauthorized handshake rejected: invalid or expired token');
      if (registerUnauthorizedHandshake(clientKey)) {
        return next(new Error('Too many requests'));
      }
      next(new Error('Unauthorized'));
    }
  });

  const subscriber = getSubscriber();

  if (!isRedisForwarderRegistered) {
    isRedisForwarderRegistered = true;
    subscriber.on("pmessage", (_pattern, channel, message) => {
      emitRedisScopedMessage(channel, message);
    });
  }

  if (!isSubscribed) {
    isSubscribed = true;

    // Subscribe to all Redis channels
    subscriber.psubscribe("board:*", "user:*", (err) => {
      if (err) console.error("Redis psubscribe error:", err);
      else console.log("Subscribed to Redis channels: board:* and user:*");
    });
  }

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.join(`user:${socket.data.userId}`);

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
export async function publishBoardUpdate(boardId: string, payload: unknown) {
  console.log(`Publishing update to Redis board:${boardId}`, payload);
  await getPublisher().publish(`board:${boardId}`, JSON.stringify(payload));
}

// Helper to publish user-scoped events so creator-owned resources stay private.
export async function publishUserUpdate(userId: string | number, payload: unknown) {
  console.log(`Publishing update to Redis user:${userId}`, payload);
  await getPublisher().publish(`user:${userId}`, JSON.stringify(payload));
}

export async function closeWsInfrastructure() {
  for (const io of activeIoServers) {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
  }
  activeIoServers.clear();

  if (sub) {
    try {
      if (isSubscribed) {
        await sub.punsubscribe("board:*", "user:*");
      }
      sub.removeAllListeners("pmessage");
      await sub.quit();
    } catch {
      sub.disconnect();
    }
    sub = null;
  }

  if (pub) {
    try {
      await pub.quit();
    } catch {
      pub.disconnect();
    }
    pub = null;
  }

  isSubscribed = false;
  isRedisForwarderRegistered = false;
  unauthorizedHandshakeAttempts.clear();
}
