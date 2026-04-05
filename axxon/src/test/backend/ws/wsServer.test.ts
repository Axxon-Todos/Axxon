import http from 'node:http';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';

import {
  closeWsInfrastructure,
  createWsServer,
  publishBoardUpdate,
} from '@/lib/wsServer';
import { signSessionToken } from '@/lib/utils/auth';

import { resetDatabase } from '../db';
import {
  addBoardMember,
  createBoardRecord,
  createUser,
} from '../factories';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(assertion: () => boolean, timeoutMs = 2_000) {
  const start = Date.now();

  while (!assertion()) {
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
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    await resetDatabase();

    server = http.createServer();
    ioServer = createWsServer(server);

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
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  async function connectClient(cookie?: string) {
    return new Promise<ClientSocket>((resolve, reject) => {
      const extraHeaders = cookie ? { cookie } : undefined;
      const client = createClient(`http://127.0.0.1:${port}`, {
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

  function createWsRoomSnapshot(boardId: number) {
    return ioServer.sockets.adapter.rooms.get(String(boardId));
  }
});
