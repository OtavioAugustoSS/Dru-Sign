import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { classificarFila, type Fila, type OrdemDaFila } from '@/domain/caixa/fila'
import { totalRecebidoPorOrdem } from './resumo'

/** Abertas e concluidas da empresa, com o total recebido de cada uma, classificadas pelo dominio. */
export async function carregarFila(empresaId: string, agora: Date = new Date()): Promise<Fila> {
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, estadoProducao: { in: ['aberta', 'concluida'] } },
    select: { id: true, numero: true, clienteNome: true, clienteApelido: true, estadoProducao: true, abertaEm: true, concluidaEm: true, prometidaPara: true, precoFinal: true },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, ordens.map((o) => o.id))
  const lista: OrdemDaFila[] = ordens.map((o) => ({
    id: o.id, numero: o.numero, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido, estadoProducao: o.estadoProducao,
    abertaEm: o.abertaEm.toISOString(), concluidaEm: o.concluidaEm?.toISOString() ?? null, prometidaPara: o.prometidaPara?.toISOString() ?? null,
    precoFinal: paraDominio(o.precoFinal).toFixed(2), totalRecebido: totais.get(o.id) ?? '0.00',
  }))
  return classificarFila(lista, agora)
}
