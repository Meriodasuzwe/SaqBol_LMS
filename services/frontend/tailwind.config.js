import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), 
  ],
  build: {
    sourcemap: false, 
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['lvh.me','saqbol.asia', 'www.saqbol.asia', 'localhost'],
    watch: {
      usePolling: true,
    },
  },
})