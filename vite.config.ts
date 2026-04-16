import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single entry chunk under dist/assets/* — no manual chunks, no dynamic imports.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
