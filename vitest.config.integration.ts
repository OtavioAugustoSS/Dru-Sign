import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      // Ver src/infra/test/server-only.ts: sem isto, testar qualquer modulo
      // marcado `server-only` morre dizendo que ele veio de um componente de
      // cliente -- e o teste de integracao roda em Node, que e o servidor.
      'server-only': resolve(import.meta.dirname, './src/infra/test/server-only.ts'),
    },
  },
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
