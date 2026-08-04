import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    chunkSizeWarningLimit: 350,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules\/(?:react|react-dom|react-router|react-router-dom|scheduler)\//,
            },
            { name: 'vendor-supabase', test: /node_modules\/@supabase\// },
            { name: 'vendor-storage', test: /node_modules\/(?:dexie|zustand)\// },
            {
              name: 'vendor-forms',
              test: /node_modules\/(?:react-hook-form|@hookform|zod)\//,
            },
          ],
        },
      },
    },
    sourcemap: true,
    target: 'es2022',
  },
  plugins: [react()],
});
