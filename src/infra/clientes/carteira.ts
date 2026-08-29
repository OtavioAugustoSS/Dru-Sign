import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { agruparPorDocumento, type Carteira, type LinhaCarteira } from '@/domain/clientes/carteira'

/** Cancelada nao faturou; orcamento ainda nao e venda. */
const FATURAM = ['aberta', 'concluida'] as const

/**
 * Uma linha por cadastro; o dominio e quem junta os cadastros do mesmo documento.
 * Venda de balcao (ordem sem cliente) fica de fora: nao ha carteira sem nome.
 */
export async function carregarCarteira(empresaId: string, agora: Date = new Date()): Promise<Carteira> {
  const [clientes, grupos] = await Promise.all([
    prisma.cliente.findMany({
      where: { empresaId, arquivadoEm: null },
      select: { id: true, nome: true, apelido: true, documento: true },
    }),
    prisma.ordemServico.groupBy({
      by: ['clienteId'],
      where: { empresaId, clienteId: { not: null }, estadoProducao: { in: [...FATURAM] } },
      _count: { _all: true },
      _sum: { precoFinal: true },
      _max: { abertaEm: true },
    }),
  ])
  const porCliente = new Map(grupos.map((g) => [g.clienteId as string, g]))
  const linhas: LinhaCarteira[] = clientes.map((c) => {
    const g = porCliente.get(c.id)
    return {
      id: c.id, nome: c.nome, apelido: c.apelido, documento: c.documento,
      ordens: g?._count._all ?? 0,
      faturado: g?._sum.precoFinal ? paraDominio(g._sum.precoFinal).toFixed(2) : '0.00',
      ultimaOrdemEm: g?._max.abertaEm?.toISOString() ?? null,
    }
  })
  return agruparPorDocumento(linhas, agora)
}
