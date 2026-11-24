import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build « application cliquable » : tout le jeu dans un seul fichier HTML
// qu'on ouvre d'un double-clic, sans installation.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
    chunkSizeWarningLimit: 5000,
  },
})
