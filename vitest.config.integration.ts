import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    // Um banco so, compartilhado: os arquivos rodam em serie.
    fileParallelism: false,
    globalSetup: ['src/infra/test/integracao-global.ts'],
    setupFiles: ['src/infra/test/integracao-setup.ts'],
    testTimeout: 20_000,
  },
})
