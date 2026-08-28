import { loadEnvConfig } from '@next/env'

// Fora do Next (Prisma CLI, seed, Vitest) carregamos os .env com a mesma ordem que o Next usa.
// Com NODE_ENV=test: .env.test.local > .env.test > .env (o .env.local e ignorado de proposito).
loadEnvConfig(process.cwd())
