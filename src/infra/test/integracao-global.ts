import { execSync } from 'node:child_process'
import { loadEnvConfig } from '@next/env'

/** Roda uma vez antes da suite: carrega .env.test(.local) e aplica as migracoes no banco de teste. */
export default function setup(): void {
  // O Vitest ja define NODE_ENV=test; com isso o @next/env le .env.test.local > .env.test.
  loadEnvConfig(process.cwd())
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente. Rode `npm run db:local:test` e copie a URL para .env.test.local')
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
