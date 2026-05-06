// Queues persisted planning run ids onto Redis in runtime and falls back to an in-memory queue for tests.
import Redis from 'ioredis';

import { getRedisUrl } from '@/lib/env/connectionConfig';

const PLANNING_RUN_QUEUE_KEY = 'planning:runs:queue';
const TEST_QUEUE: number[] = [];

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

function createRedisClient() {
  const client = new Redis(getRedisUrl());
  client.on('error', (error) => {
    console.error('Planning run queue Redis error:', error);
  });
  return client;
}

let enqueueClient: Redis | null = null;
let workerClient: Redis | null = null;

function getEnqueueClient() {
  if (!enqueueClient) {
    enqueueClient = createRedisClient();
  }

  return enqueueClient;
}

function getWorkerClient() {
  if (!workerClient) {
    workerClient = createRedisClient();
  }

  return workerClient;
}

export async function enqueuePlanningRun(runId: number) {
  if (isTestEnvironment()) {
    TEST_QUEUE.push(runId);
    return;
  }

  await getEnqueueClient().lpush(PLANNING_RUN_QUEUE_KEY, String(runId));
}

export async function dequeuePlanningRun(timeoutSeconds = 5) {
  if (isTestEnvironment()) {
    return TEST_QUEUE.shift() ?? null;
  }

  const result = await getWorkerClient().brpop(PLANNING_RUN_QUEUE_KEY, timeoutSeconds);

  if (!result || result.length < 2) {
    return null;
  }

  const parsedRunId = Number(result[1]);
  return Number.isFinite(parsedRunId) ? parsedRunId : null;
}

export async function closePlanningRunQueue() {
  if (enqueueClient) {
    try {
      await enqueueClient.quit();
    } catch {
      enqueueClient.disconnect();
    }
    enqueueClient = null;
  }

  if (workerClient) {
    try {
      await workerClient.quit();
    } catch {
      workerClient.disconnect();
    }
    workerClient = null;
  }

  TEST_QUEUE.length = 0;
}
