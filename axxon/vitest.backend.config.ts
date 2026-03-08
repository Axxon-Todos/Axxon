import path from 'node:path';
import { defineConfig } from 'vitest/config';

const rootDir = path.resolve(__dirname);

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/backend/**/*.test.ts'],
    setupFiles: ['./src/test/backend/setup.ts'],
    globalSetup: ['./src/test/backend/globalSetup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    pool: 'forks',
    clearMocks: true,
    restoreMocks: true,
  },
});
