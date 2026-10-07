import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  // Same JSX runtime as Next.js, so components can be rendered in tests without importing React.
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
