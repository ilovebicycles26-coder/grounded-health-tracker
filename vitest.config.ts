import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: { reporter: ['text', 'html'] },
    fileParallelism: false,
    include: ['apps/**/*.{test,spec}.{ts,tsx}', 'packages/**/*.{test,spec}.{ts,tsx}'],
    maxWorkers: 1,
    passWithNoTests: false,
    pool: 'threads',
  },
});
