import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from '@/infra/env'

function criarClient(): PrismaClient {
  const { DATABASE_URL, DATABASE_POOL_MAX } = env()
  // `max` so quando definido: na Neon fica o padrao do pg; no prisma dev local, 2 (ver .env.example).
  const adapter = new PrismaPg(DATABASE_POOL_MAX === undefined ? { connectionString: DATABASE_URL } : { connectionString: DATABASE_URL, max: DATABASE_POOL_MAX })
  return new PrismaClient({ adapter })
}

// Uma instancia so, mesmo com o hot reload do `next dev`.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalParaPrisma.prisma ?? criarClient()

if (env().NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
