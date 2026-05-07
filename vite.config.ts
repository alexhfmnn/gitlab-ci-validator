import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/gitlab-ci-validator/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@codemirror') || id.includes('codemirror') || id.includes('@uiw')) {
            return 'codemirror';
          }
          if (id.includes('/ajv/') || id.includes('/ajv-')) return 'ajv';
          if (id.includes('/js-yaml/')) return 'js-yaml';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.css',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/main.tsx',
        'src/types.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
        // lib/ holds the pure logic; require ~full coverage there.
        'src/lib/**': {
          lines: 99,
          functions: 100,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
});
