// Hosts authenticated Socket.IO rooms for board-scoped realtime updates and private user-scoped events.
import { Server } from "socket.io";
import http from "http";
import Redis from "ioredis";
import {
  getConfiguredClientOrigins,
  getRedisUrl,
} from '@/lib/env/connectionConfig';
import { BoardMembers } from '@/lib/models/boardMembers';
import { Projects } from '@/lib/models/projects';
import { requireProjectMember } from '@/lib/utils/authorization';
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
const PROJECT_PRESENCE_TTL_SECONDS = 30;
const PROJECT_PRESENCE_HEARTBEAT_MS = 10_000;

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

// Returns the Redis hash key that stores the active socket presence for a project.
function getProjectPresenceKey(projectId: string) {
  return `project:presence:${projectId}`;
}

// Reads the shared project presence snapshot from Redis and restores its object values.
async function getProjectPresenceSnapshot(projectId: string) {
  const key = getProjectPresenceKey(projectId);
  const entries = await getPublisher().hgetall(key);
  const staleSocketIds: string[] = [];
  const cutoff = Date.now() - PROJECT_PRESENCE_TTL_SECONDS * 1_000;
  const snapshot = Object.entries(entries).flatMap(([socketId, entry]) => {
    try {
      const presence = JSON.parse(entry);
      const lastSeenAt = Number(presence?.lastSeenAt);
      if (!presence || typeof presence !== 'object' || !Number.isFinite(lastSeenAt) || lastSeenAt < cutoff) {
        staleSocketIds.push(socketId);
        return [];
      }
      return [presence as Record<string, unknown>];
    } catch {
      staleSocketIds.push(socketId);
      return [];
    }
  });

  if (staleSocketIds.length > 0) {
    await getPublisher().hdel(key, ...staleSocketIds);
  }

  return snapshot;
}

// Removes one socket's shared presence and returns its last published value for cleanup.
async function removeProjectPresence(projectId: string, socketId: string) {
  const key = getProjectPresenceKey(projectId);
  const existing = await getPublisher().hget(key, socketId);
  if (existing) {
    await getPublisher().hdel(key, socketId);
  }

  return existing ? JSON.parse(existing) as Record<string, unknown> : null;
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
    subscriber.psubscribe("board:*", "project:*", "user:*", (err) => {
      if (err) console.error("Redis psubscribe error:", err);
      else console.log("Subscribed to Redis channels: board:* and user:*");
    });
  }

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.join(`user:${socket.data.userId}`);

    let currentBoard: string | null = null;
    let currentProject: string | null = null;
    let projectOperation = Promise.resolve();
    let projectJoinVersion = 0;

    // Serializes project room transitions and presence writes for one socket.
    const enqueueProjectOperation = (operation: () => Promise<void> | void) => {
      const next = projectOperation.then(operation, operation);
      projectOperation = next.then(() => undefined, () => undefined);
      return next;
    };

    // Refreshes this socket's Redis presence lease while it remains in a project room.
    const refreshProjectPresence = async (projectId: string) => {
      const key = getProjectPresenceKey(projectId);
      const existing = await getPublisher().hget(key, socket.id);
      if (!existing) return;

      try {
        const presence = JSON.parse(existing) as Record<string, unknown>;
        presence.lastSeenAt = Date.now();
        await getPublisher().hset(key, socket.id, JSON.stringify(presence));
        await getPublisher().expire(key, PROJECT_PRESENCE_TTL_SECONDS);
      } catch {
        await getPublisher().hdel(key, socket.id);
      }
    };

    // Removes this socket's shared presence and tells every project-room subscriber that it left.
    const clearProjectPresence = async (projectId: string | null) => {
      if (!projectId) return;
      const existing = await removeProjectPresence(projectId, socket.id);
      if (!existing) return;
      await publishProjectUpdate(projectId, {
        type: 'project:presence:updated',
        payload: { ...existing, componentId: null, relationshipId: null, status: 'idle' },
      }).catch((error) => console.error('[WS_PROJECT_PRESENCE_CLEANUP_ERROR]', error));
    };

    const presenceHeartbeat = setInterval(() => {
      const projectId = currentProject;
      if (!projectId) return;
      void enqueueProjectOperation(() => refreshProjectPresence(projectId)).catch((error) => {
        console.error('[WS_PROJECT_PRESENCE_HEARTBEAT_ERROR]', error);
      });
    }, PROJECT_PRESENCE_HEARTBEAT_MS);
    presenceHeartbeat.unref?.();

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

    socket.on("joinProject", (projectId: string, acknowledge?: (result: { ok: boolean }) => void) => {
      const joinVersion = ++projectJoinVersion;
      void enqueueProjectOperation(async () => {
        try {
          const numericProjectId = Number(projectId);
          const project = await Projects.getById(numericProjectId);
          if (!Number.isFinite(numericProjectId) || !project) {
            socket.emit('socket:error', { error: 'Forbidden' });
            acknowledge?.({ ok: false });
            return;
          }
          await requireProjectMember(project.organization_id, numericProjectId, Number(socket.data.userId));
          if (joinVersion !== projectJoinVersion) {
            acknowledge?.({ ok: false });
            return;
          }
          const nextProject = String(numericProjectId);
          if (currentProject === nextProject) {
            acknowledge?.({ ok: true });
            return;
          }
          const previousProject = currentProject;
          currentProject = null;
          if (previousProject) {
            socket.leave(`project:${previousProject}`);
            await clearProjectPresence(previousProject);
          }
          if (joinVersion !== projectJoinVersion) {
            acknowledge?.({ ok: false });
            return;
          }
          socket.join(`project:${nextProject}`);
          currentProject = nextProject;
          const snapshot = await getProjectPresenceSnapshot(nextProject);
          if (joinVersion !== projectJoinVersion || currentProject !== nextProject) {
            acknowledge?.({ ok: false });
            return;
          }
          socket.emit('project:presence:snapshot', snapshot);
          acknowledge?.({ ok: true });
        } catch (error) {
          console.error(`Socket ${socket.id} failed to join project ${projectId}:`, error);
          socket.emit('socket:error', { error: 'Failed to join project' });
          acknowledge?.({ ok: false });
        }
      }).catch((error) => console.error('[WS_PROJECT_JOIN_ERROR]', error));
    });

    socket.on("leaveProject", () => {
      projectJoinVersion += 1;
      void enqueueProjectOperation(async () => {
        const leavingProject = currentProject;
        currentProject = null;
        if (leavingProject) socket.leave(`project:${leavingProject}`);
        await clearProjectPresence(leavingProject);
      }).catch((error) => console.error('[WS_PROJECT_PRESENCE_CLEANUP_ERROR]', error));
    });

    socket.on('project:presence', (presence: Record<string, unknown>) => {
      void enqueueProjectOperation(async () => {
        const projectId = currentProject;
        if (!projectId) return;
        const safePresence = {
          socketId: socket.id,
          userId: Number(socket.data.userId),
          componentId: typeof presence?.componentId === 'string' ? presence.componentId : null,
          relationshipId: typeof presence?.relationshipId === 'string' ? presence.relationshipId : null,
          viewKey: typeof presence?.viewKey === 'string' ? presence.viewKey : null,
          status: presence?.status === 'idle' ? 'idle' : 'active',
          lastSeenAt: Date.now(),
        };
        const presenceKey = getProjectPresenceKey(projectId);
        if (safePresence.status === 'idle') {
          await getPublisher().hdel(presenceKey, socket.id);
        } else {
          await getPublisher().hset(presenceKey, socket.id, JSON.stringify(safePresence));
          await getPublisher().expire(presenceKey, PROJECT_PRESENCE_TTL_SECONDS);
        }
        await publishProjectUpdate(projectId, { type: 'project:presence:updated', payload: safePresence }).catch((error) => console.error('[WS_PROJECT_PRESENCE_ERROR]', error));
      }).catch((error) => console.error('[WS_PROJECT_PRESENCE_ERROR]', error));
    });

    socket.on('project:selection', async (selection: Record<string, unknown>) => {
      if (!currentProject) return;
      const payload = {
        socketId: socket.id,
        userId: Number(socket.data.userId),
        componentId: typeof selection?.componentId === 'string' ? selection.componentId : null,
        relationshipId: typeof selection?.relationshipId === 'string' ? selection.relationshipId : null,
        viewKey: typeof selection?.viewKey === 'string' ? selection.viewKey : null,
      };
      await publishProjectUpdate(currentProject, { type: 'project:selection:updated', payload }).catch((error) => console.error('[WS_PROJECT_SELECTION_ERROR]', error));
    });

    // Handle disconnects
    socket.on("disconnect", () => {
      clearInterval(presenceHeartbeat);
      projectJoinVersion += 1;
      void enqueueProjectOperation(async () => {
        const leavingProject = currentProject;
        currentProject = null;
        await clearProjectPresence(leavingProject);
      }).catch((error) => console.error('[WS_PROJECT_PRESENCE_CLEANUP_ERROR]', error));
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

// Publishes updates to the authenticated project room used by architecture workspaces.
export async function publishProjectUpdate(projectId: string | number, payload: unknown) {
  console.log(`Publishing update to Redis project:${projectId}`, payload);
  await getPublisher().publish(`project:${projectId}`, JSON.stringify(payload));
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
        await sub.punsubscribe("board:*", "project:*", "user:*");
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
