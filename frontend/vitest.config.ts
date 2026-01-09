import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'], // 👈 這裡指定 setup 檔案
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'tests@': path.resolve(__dirname, './__tests__'),
    },
  },
})

