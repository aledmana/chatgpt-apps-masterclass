import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const FULL_URL = "https://flashcards-server.aledmana.workers.dev/";

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    base: mode === "production" ? FULL_URL : undefined,
    build: {
      outDir: "../server/dist",
      emptyOutDir: true,
    },
  };
})