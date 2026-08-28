import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'prisma/config'

// Mesma ordem de leitura do Next: .env.<modo>.local > .env.local > .env.<modo> > .env
loadEnvConfig(process.cwd())

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // O CLI (migrate) precisa de conexao direta (na Neon, sem -pooler).
    // Sem env(): `prisma generate` nao pode quebrar quando nao ha banco (postinstall na Vercel).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
})
