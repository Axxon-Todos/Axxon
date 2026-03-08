import { afterEach, vi } from 'vitest';

import { applyBackendTestEnv } from './env';

applyBackendTestEnv();

afterEach(() => {
  vi.restoreAllMocks();
});
