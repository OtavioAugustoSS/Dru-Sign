import { paraDominio } from '@/infra/db/decimal'
import type { prisma } from '@/infra/db/prisma'
import type { Tx } from '@/infra/mutacoes/idempotencia'

export type Db = Tx | typeof prisma

/** Soma dos recebimentos vivos (nao estornados) por ordem, como string decimal. Ordem sem recebimento nao aparece no Map. */
export async function totalRecebidoPorOrdem(db: Db, empresaId: string, ordemIds: string[]): Promise<Map<string, string>> {
  if (ordemIds.length === 0) return new Map()
  const grupos = await db.recebimento.groupBy({
    by: ['ordemId'],
    where: { empresaId, ordemId: { in: ordemIds }, estornadoEm: null },
    _sum: { valor: true },
  })
  return new Map(grupos.map((g) => [g.ordemId, g._sum.valor ? paraDominio(g._sum.valor).toFixed(2) : '0.00']))
}
