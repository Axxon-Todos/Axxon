// Verifies planning executor selection across local and externally configured AI runtimes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedEnsureLocalOllamaPlanningReady } = vi.hoisted(() => ({
  mockedEnsureLocalOllamaPlanningReady: vi.fn(),
}));

vi.mock('@/lib/ai/localOllamaRuntime', () => ({
  ensureLocalOllamaPlanningReady: mockedEnsureLocalOllamaPlanningReady,
}));

describe('planningExecutors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('keeps the local planning executor for development-like stages', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    const {
      resolveDefaultPlanningExecutorKind,
      resolvePlanningExecutor,
    } = await import('@/lib/ai/planningExecutors');

    expect(resolveDefaultPlanningExecutorKind()).toBe('local_ollama');

    await resolvePlanningExecutor('local_ollama').assertReady();

    expect(mockedEnsureLocalOllamaPlanningReady).toHaveBeenCalledWith({
      baseUrl: 'http://ollama:11434',
      model: 'qwen2.5-coder:14b',
    });
  });

  it('uses the external planning executor in production when external AI is configured', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'production');
    vi.stubEnv('AI_CLOUD_BASE_URL', 'https://llm.example.com');
    vi.stubEnv('AI_CLOUD_MODEL', 'gpt-4o-mini');

    const {
      resolveDefaultPlanningExecutorKind,
      resolvePlanningExecutor,
    } = await import('@/lib/ai/planningExecutors');

    expect(resolveDefaultPlanningExecutorKind()).toBe('external_llm');
    await expect(
      resolvePlanningExecutor('external_llm').assertReady()
    ).resolves.toBeUndefined();
    expect(mockedEnsureLocalOllamaPlanningReady).not.toHaveBeenCalled();
  });

  it('fails external planning readiness when production AI is not configured', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'production');

    const { resolvePlanningExecutor } = await import('@/lib/ai/planningExecutors');

    await expect(
      resolvePlanningExecutor('external_llm').assertReady()
    ).rejects.toThrow('External AI provider is not configured for this environment');
  });
});
