import { afterAll, beforeEach } from 'vitest'
import '@/infra/carrega-env'
import { exigirBancoDeTeste } from './banco-de-teste'
import { prisma } from '@/infra/db/prisma'

/** TRUNCATE em todas as tabelas (menos a de migracoes) antes de cada teste — so no banco de teste. */
async function limparBanco(): Promise<void> {
  exigirBancoDeTeste(process.env.DATABASE_URL)
  const linhas = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  const tabelas = linhas
    .map((l) => l.tablename)
    .filter((n) => n !== '_prisma_migrations')
    .map((n) => `"public"."${n}"`)
    .join(', ')
  if (tabelas.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE;`)
  }
}

beforeEach(async () => {
  await limparBanco()
})

afterAll(async () => {
  await prisma.$disconnect()
})
