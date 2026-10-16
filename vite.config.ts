import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/*.gif', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.cbz', '**/*.zip', '**/.git/**', '**/dist/**'],
    },
  },
});