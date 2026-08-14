// Runs durable agent jobs independently from Socket.IO and advances runs through the state machine.
import db from '@/lib/db/db';
import { applyWorkerPreparation, claimAgentRunForWork, deliverAgentDispatch, failAgentRun } from '../application/runService';
import { AgentRepository } from '../infrastructure/repository';
import { planWithOllama } from '../providers/ollama';

const workerId = `agent-worker-${process.pid}`;

export async function processNextAgentJob() {
  const job = await db.transaction(async (trx) => {
    await AgentRepository.requeueStaleJobs(new Date(Date.now() - 5 * 60_000), trx);
    return AgentRepository.claimJob(workerId, trx);
  });
  if (!job) return false;

  try {
    const run = await AgentRepository.getRun(Number(job.run_id));
    if (!run) throw new Error('Agent run not found');
    if (job.kind === 'prepare') {
      const claimedRun = await claimAgentRunForWork(run.id);
      if (!claimedRun) {
        await AgentRepository.finishJob(Number(job.id), null);
        return true;
      }
      const messages = await AgentRepository.listMessages(claimedRun.id);
      const result = await planWithOllama(claimedRun, messages.map((message) => ({ role: String(message.role), content: String(message.content) })));
      await applyWorkerPreparation(run.id, result);
    } else if (job.kind === 'dispatch') {
      await deliverAgentDispatch(run.id);
    } else {
      throw new Error(`Unsupported agent job kind: ${job.kind}`);
    }
    await AgentRepository.finishJob(Number(job.id), null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent worker failed';
    await failAgentRun(Number(job.run_id), message);
    await AgentRepository.finishJob(Number(job.id), message);
  }

  return true;
}

export async function runAgentWorker(signal: AbortSignal) {
  while (!signal.aborted) {
    const processed = await processNextAgentJob();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
