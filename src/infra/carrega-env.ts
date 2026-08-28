import { createRequire } from 'node:module'

// Fora do Next (Prisma CLI, seed, Vitest) carregamos os .env com a mesma ordem que o Next usa.
// Com NODE_ENV=test: .env.test.local > .env.test > .env (o .env.local e ignorado de proposito).
// O @next/env e CommonJS empacotado: sob o tsx o import nomeado falha, por isso o require.
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')

loadEnvConfig(process.cwd())
