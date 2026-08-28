import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from '@/infra/env'

function criarClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL })
  return new PrismaClient({ adapter })
}

// Uma instancia so, mesmo com o hot reload do `next dev`.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalParaPrisma.prisma ?? criarClient()

if (env().NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
