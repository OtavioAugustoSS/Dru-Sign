import { createRequire } from 'node:module'
import { defineConfig, devices } from '@playwright/test'

// Le .env.local com a mesma ordem do Next: o teste precisa das credenciais do seed.
// O @next/env e CommonJS empacotado: sob o Node ESM o import nomeado falha, por isso o require.
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')
loadEnvConfig(process.cwd())

const porta = 3000
const baseURL = `http://localhost:${porta}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? `npm run build && npx next start -p ${porta}` : `npx next dev -p ${porta}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
