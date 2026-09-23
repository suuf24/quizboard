import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the contents of dist/ can be copied anywhere: a subfolder on a
  // school PC, a USB stick, or any static host.
  base: './',
  server: {
    port: 5173,
    host: 'localhost',
  },
})
