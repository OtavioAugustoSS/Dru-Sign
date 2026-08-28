import { execSync } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { exigirBancoDeTeste } from './banco-de-teste'

/** Roda uma vez antes da suite: carrega .env.test(.local) e aplica as migracoes no banco de teste. */
export default function setup(): void {
  // O Vitest ja define NODE_ENV=test; com isso o @next/env le .env.test.local > .env.test.
  loadEnvConfig(process.cwd())
  exigirBancoDeTeste(process.env.DATABASE_URL)
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
