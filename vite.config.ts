import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — чтобы статика работала на GitHub Pages по пути /<repo>/
export default defineConfig({
  plugins: [react()],
  base: './',
})
