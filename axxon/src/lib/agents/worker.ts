// Starts the standalone agent worker process used by development and container runtime commands.
import { loadRuntimeEnv } from '@/lib/env/loadRuntimeEnv';
import { runAgentWorker } from './worker/agentWorker';

loadRuntimeEnv();

const abortController = new AbortController();
process.once('SIGINT', () => abortController.abort());
process.once('SIGTERM', () => abortController.abort());
void runAgentWorker(abortController.signal);
