// Loads runtime environment variables once, with optional Docker overrides when enabled.
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

let runtimeEnvLoaded = false;

const resolveEnvPath = (filename: string) => path.resolve(process.cwd(), filename);

export function loadRuntimeEnv() {
  if (runtimeEnvLoaded) {
    return;
  }

  const localEnvPath = resolveEnvPath('.env.local');
  const dockerEnvPath = resolveEnvPath('.env.docker');

  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }

  if (process.env.AXXON_ENV_MODE === 'docker' && fs.existsSync(dockerEnvPath)) {
    dotenv.config({ path: dockerEnvPath, override: true });
  }

  dotenv.config();
  runtimeEnvLoaded = true;
}
