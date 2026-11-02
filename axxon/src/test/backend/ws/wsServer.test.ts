import http from 'node:http';
import Redis from 'ioredis';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';

import {
  closeWsInfrastructure,
  createWsServer,
  publishBoardUpdate,
} from '@/lib/wsServer';
import { Projects } from '@/lib/models/projects';
import { getRedisUrl } from '@/lib/env/connectionConfig';
import { signSessionToken } from '@/lib/utils/auth';

import { resetDatabase } from '../db';
import {
  addBoardMember,
  addOrganizationMember,
  createBoardRecord,
  createOrganizationRecord,
  createUser,
} from '../factories';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Waits for asynchronous websocket state to become observable in the test process.
async function waitForCondition(assertion: () => boolean | Promise<boolean>, timeoutMs = 2_000) {
  const start = Date.now();

  while (!(await assertion())) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error('Condition was not met before timeout');
    }
    await delay(25);
  }
}

describe('wsServer', () => {
  let server: http.Server;
  let ioServer: Server;
  let port: number;
  const servers: http.Server[] = [];
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    await resetDatabase();

    server = http.createServer();
    ioServer = createWsServer(server);
    servers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start websocket test server');
    }

    port = address.port;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;

    await closeWsInfrastructure();
    await Promise.all(servers.filter((candidate) => candidate.listening).map((candidate) => new Promise<void>((resolve, reject) => {
      candidate.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    })));
    servers.length = 0;
  });

  async function connectClient(cookie?: string, targetPort = port) {
    return new Promise<ClientSocket>((resolve, reject) => {
      const extraHeaders = cookie ? { cookie } : undefined;
      const client = createClient(`http://127.0.0.1:${targetPort}`, {
        transports: ['websocket'],
        reconnection: false,
        withCredentials: true,
        extraHeaders,
        transportOptions: {
          websocket: {
            extraHeaders,
          },
        },
      });

      clients.push(client);

      client.once('connect', () => resolve(client));
      client.once('connect_error', (error) => reject(error));
    });
  }

  async function createAuthCookie(userId: number) {
    const token = await signSessionToken({
      id: userId,
      email: `user${userId}@example.com`,
    });

    return `token=${encodeURIComponent(token)}`;
  }

  it('rejects unauthenticated socket connections', async () => {
    await expect(connectClient()).rejects.toMatchObject({
      message: 'Unauthorized',
    });
  });

  it('emits a socket error for invalid board ids', async () => {
    const user = await createUser();
    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);

    const errorPayloadPromise = new Promise<{ error: string }>((resolve) => {
      client.once('socket:error', resolve);
    });

    client.emit('joinBoard', 'not-a-number');

    await expect(errorPayloadPromise).resolves.toEqual({ error: 'Invalid board id' });
  });

  it('emits a forbidden error when the user is not a board member', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const user = await createUser({ email: 'member@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });
    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);

    const errorPayloadPromise = new Promise<{ error: string }>((resolve) => {
      client.once('socket:error', resolve);
    });

    client.emit('joinBoard', String(board.id));

    await expect(errorPayloadPromise).resolves.toEqual({ error: 'Forbidden' });
  });

  it('joins the requested board room and leaves the previous room when switching boards', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const user = await createUser({ email: 'member@example.com' });
    const firstBoard = await createBoardRecord({ createdBy: creator.id });
    const secondBoard = await createBoardRecord({ createdBy: creator.id });

    await addBoardMember(firstBoard.id, user.id);
    await addBoardMember(secondBoard.id, user.id);

    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);

    client.emit('joinBoard', String(firstBoard.id));

    await waitForCondition(() =>
      Boolean(createWsRoomSnapshot(firstBoard.id)?.has(client.id ?? ''))
    );

    client.emit('joinBoard', String(secondBoard.id));

    await waitForCondition(
      () =>
        !createWsRoomSnapshot(firstBoard.id)?.has(client.id ?? '') &&
        Boolean(createWsRoomSnapshot(secondBoard.id)?.has(client.id ?? ''))
    );
  });

  it('forwards Redis board updates to the correct socket room', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const user = await createUser({ email: 'member@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });

    await addBoardMember(board.id, user.id);

    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);
    client.emit('joinBoard', String(board.id));

    await waitForCondition(() => Boolean(createWsRoomSnapshot(board.id)?.has(client.id ?? '')));

    const eventPromise = new Promise<{ id: number }>((resolve) => {
      client.once('board:todo:created', resolve);
    });

    await publishBoardUpdate(String(board.id), {
      type: 'todo:created',
      payload: { id: 88 },
    });

    await expect(eventPromise).resolves.toEqual({ id: 88 });
  });

  it('forwards sprint updates to the correct socket room', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const user = await createUser({ email: 'member@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });

    await addBoardMember(board.id, user.id);

    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);
    client.emit('joinBoard', String(board.id));

    await waitForCondition(() => Boolean(createWsRoomSnapshot(board.id)?.has(client.id ?? '')));

    const eventPromise = new Promise<{ id: number; name: string }>((resolve) => {
      client.once('board:sprint:updated', resolve);
    });

    await publishBoardUpdate(String(board.id), {
      type: 'sprint:updated',
      payload: { id: 12, name: 'Execution Sprint' },
    });

    await expect(eventPromise).resolves.toEqual({ id: 12, name: 'Execution Sprint' });
  });

  it('falls back to board:update when Redis payloads omit a type', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const user = await createUser({ email: 'member@example.com' });
    const board = await createBoardRecord({ createdBy: creator.id });

    await addBoardMember(board.id, user.id);

    const cookie = await createAuthCookie(user.id);
    const client = await connectClient(cookie);
    client.emit('joinBoard', String(board.id));

    await waitForCondition(() => Boolean(createWsRoomSnapshot(board.id)?.has(client.id ?? '')));

    const eventPromise = new Promise<{ payload: { id: number } }>((resolve) => {
      client.once('board:update', resolve);
    });

    await publishBoardUpdate(String(board.id), {
      payload: { id: 10 },
    });

    await expect(eventPromise).resolves.toEqual({
      payload: { id: 10 },
    });
  });

  it('shares project presence snapshots and socket cleanup across websocket instances', async () => {
    const owner = await createUser({ email: 'project-owner@example.com' });
    const member = await createUser({ email: 'project-member@example.com' });
    const organization = await createOrganizationRecord({ createdBy: owner.id });
    await addOrganizationMember(organization.id, member.id);
    const project = await Projects.create({
      organization_id: organization.id,
      name: 'Shared presence project',
      description: null,
      created_by: owner.id,
    });

    const secondServer = http.createServer();
    createWsServer(secondServer);
    servers.push(secondServer);
    await new Promise<void>((resolve) => secondServer.listen(0, () => resolve()));
    const secondAddress = secondServer.address();
    if (!secondAddress || typeof secondAddress === 'string') throw new Error('Failed to start second websocket test server');

    const cookie = await createAuthCookie(member.id);
    const firstClient = await connectClient(cookie);
    const firstSocketId = firstClient.id;
    const firstJoin = new Promise<{ ok: boolean }>((resolve) => firstClient.emit('joinProject', String(project.id), resolve));
    await expect(firstJoin).resolves.toEqual({ ok: true });

    firstClient.emit('project:presence', {
      componentId: 'api',
      viewKey: 'backend',
      status: 'active',
    });

    const secondClient = await connectClient(cookie, secondAddress.port);
    const snapshotPromise = new Promise<Array<Record<string, unknown>>>((resolve) => {
      secondClient.once('project:presence:snapshot', resolve);
    });
    const secondJoin = new Promise<{ ok: boolean }>((resolve) => secondClient.emit('joinProject', String(project.id), resolve));
    await expect(secondJoin).resolves.toEqual({ ok: true });
    await expect(snapshotPromise).resolves.toEqual([
      expect.objectContaining({
        socketId: firstClient.id,
        userId: member.id,
        componentId: 'api',
        status: 'active',
      }),
    ]);

    const cleanupPromise = new Promise<Record<string, unknown>>((resolve) => {
      secondClient.once('project:presence:updated', resolve);
    });
    firstClient.disconnect();
    await expect(cleanupPromise).resolves.toEqual(expect.objectContaining({
      socketId: firstSocketId,
      status: 'idle',
    }));

    const thirdClient = await connectClient(cookie, secondAddress.port);
    const cleanedSnapshot = new Promise<Array<Record<string, unknown>>>((resolve) => {
      thirdClient.once('project:presence:snapshot', resolve);
    });
    const thirdJoin = new Promise<{ ok: boolean }>((resolve) => thirdClient.emit('joinProject', String(project.id), resolve));
    await expect(thirdJoin).resolves.toEqual({ ok: true });
    await expect(cleanedSnapshot).resolves.toEqual([]);
  });

  it('prunes stale Redis presence entries before sending a snapshot', async () => {
    const owner = await createUser({ email: 'stale-owner@example.com' });
    const member = await createUser({ email: 'stale-member@example.com' });
    const organization = await createOrganizationRecord({ createdBy: owner.id });
    await addOrganizationMember(organization.id, member.id);
    const project = await Projects.create({
      organization_id: organization.id,
      name: 'Stale presence project',
      description: null,
      created_by: owner.id,
    });
    const redis = new Redis(getRedisUrl());
    const key = `project:presence:${project.id}`;

    try {
      await redis.hset(key, 'stale-socket', JSON.stringify({
        socketId: 'stale-socket',
        userId: member.id,
        status: 'active',
        lastSeenAt: Date.now() - 31_000,
      }));

      const client = await connectClient(await createAuthCookie(member.id));
      const snapshotPromise = new Promise<Array<Record<string, unknown>>>((resolve) => {
        client.once('project:presence:snapshot', resolve);
      });
      const joinPromise = new Promise<{ ok: boolean }>((resolve) => client.emit('joinProject', String(project.id), resolve));

      await expect(joinPromise).resolves.toEqual({ ok: true });
      await expect(snapshotPromise).resolves.toEqual([]);
      await expect(redis.hget(key, 'stale-socket')).resolves.toBeNull();
    } finally {
      await redis.del(key);
      await redis.quit();
    }
  });

  it('keeps presence writes on the new project when a room switch is in flight', async () => {
    const owner = await createUser({ email: 'switch-owner@example.com' });
    const member = await createUser({ email: 'switch-member@example.com' });
    const organization = await createOrganizationRecord({ createdBy: owner.id });
    await addOrganizationMember(organization.id, member.id);
    const firstProject = await Projects.create({
      organization_id: organization.id,
      name: 'First switch project',
      description: null,
      created_by: owner.id,
    });
    const secondProject = await Projects.create({
      organization_id: organization.id,
      name: 'Second switch project',
      description: null,
      created_by: owner.id,
    });
    const redis = new Redis(getRedisUrl());

    try {
      const client = await connectClient(await createAuthCookie(member.id));
      await expect(new Promise<{ ok: boolean }>((resolve) => client.emit('joinProject', String(firstProject.id), resolve))).resolves.toEqual({ ok: true });

      const switchPromise = new Promise<{ ok: boolean }>((resolve) => client.emit('joinProject', String(secondProject.id), resolve));
      client.emit('project:presence', { componentId: 'new-project', status: 'active' });

      await expect(switchPromise).resolves.toEqual({ ok: true });
      await waitForCondition(async () => Boolean(await redis.hget(`project:presence:${secondProject.id}`, client.id ?? '')));
      await expect(redis.hget(`project:presence:${firstProject.id}`, client.id ?? '')).resolves.toBeNull();
      await expect(redis.ttl(`project:presence:${secondProject.id}`)).resolves.toBeGreaterThan(0);
    } finally {
      await redis.del(`project:presence:${firstProject.id}`, `project:presence:${secondProject.id}`);
      await redis.quit();
    }
  });

  function createWsRoomSnapshot(boardId: number) {
    return ioServer.sockets.adapter.rooms.get(String(boardId));
  }
});
