import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix @react-spring/core ESM resolution issue with @react-three/drei
      '@react-spring/core': path.resolve(
        './node_modules/@react-spring/core/dist/cjs/index.js'
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
