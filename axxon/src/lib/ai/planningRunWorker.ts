// Runs a long-lived planning worker loop that dequeues persisted planning runs and advances them asynchronously.
import { dequeuePlanningRun } from '@/lib/ai/planningRunQueue';
import { processQueuedPlanningRun } from '@/lib/controllers/ai/organizationAiPlanningControllers';

let workerStarted = false;
let workerShouldRun = false;

async function runWorkerLoop() {
  while (workerShouldRun) {
    try {
      const runId = await dequeuePlanningRun();

      if (!workerShouldRun) {
        break;
      }

      if (!runId) {
        continue;
      }

      await processQueuedPlanningRun(runId);
    } catch (error) {
      console.error('Planning run worker failed to process a queue item:', error);
    }
  }
}

export function startPlanningRunWorker() {
  if (workerStarted || process.env.NODE_ENV === 'test') {
    return;
  }

  workerStarted = true;
  workerShouldRun = true;
  void runWorkerLoop();
}

export function stopPlanningRunWorker() {
  workerShouldRun = false;
  workerStarted = false;
}
