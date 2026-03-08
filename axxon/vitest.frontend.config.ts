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
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
    },
    include: ['src/test/frontend/**/*.test.ts', 'src/test/frontend/**/*.test.tsx'],
    setupFiles: ['./src/test/frontend/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
