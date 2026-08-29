import { prisma } from '@/infra/db/prisma'
import { classificarUrgencia, type FilaProducao, type OrdemDaProducao } from '@/domain/producao/urgencia'

/**
 * So o que esta em producao: orcamento ainda nao foi aprovado, concluida ja saiu e
 * cancelada nao existe mais. Nenhum valor sai daqui — a producao nao ve dinheiro.
 */
export async function carregarFilaProducao(empresaId: string, agora: Date = new Date()): Promise<FilaProducao> {
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, estadoProducao: 'aberta' },
    select: {
      id: true, numero: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, versao: true,
      itens: { where: { removidoEm: null }, orderBy: { ordemExibicao: 'asc' }, select: { descricao: true } },
    },
  })
  const lista: OrdemDaProducao[] = ordens.map((o) => ({
    id: o.id, numero: o.numero, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
    abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null,
    versao: o.versao, itens: o.itens.map((i) => i.descricao),
  }))
  return classificarUrgencia(lista, agora)
}
