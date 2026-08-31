import { prisma } from '@/infra/db/prisma'
import { classificarUrgencia, type FilaProducao, type ItemDaProducao, type OrdemDaProducao } from '@/domain/producao/urgencia'
import { formatarDimensao } from '@/domain/ordem/impresso'
import { paraDominio } from '@/infra/db/decimal'

/**
 * A linha que a producao le na bancada.
 *
 * Ate aqui vinha so a descricao -- "PLACA ACM 60 X 80 E ADESIVO IMPRESSO" --
 * e a fila nao dizia se era UMA placa ou SEIS. Quem esta na bancada precisa
 * saber quantas antes de qualquer outra coisa; a descricao sozinha manda a
 * pessoa abrir a ordem para descobrir o numero, ou pior, produzir errado.
 *
 * A medida entra junto quando existe: e a diferenca entre cortar 60x80 e 80x60.
 */
function linhaDoItem(i: { descricao: string; quantidade: number; altura: unknown; largura: unknown }): ItemDaProducao {
  const altura = i.altura === null ? null : Number(paraDominio(i.altura as never).toFixed())
  const largura = i.largura === null ? null : Number(paraDominio(i.largura as never).toFixed())
  return {
    quantidade: i.quantidade,
    descricao: i.descricao,
    medida: altura !== null && largura !== null ? formatarDimensao(altura, largura) : null,
  }
}

/**
 * So o que esta em producao: orcamento ainda nao foi aprovado, concluida ja saiu e
 * cancelada nao existe mais. Nenhum valor sai daqui — a producao nao ve dinheiro.
 */
export async function carregarFilaProducao(empresaId: string, agora: Date = new Date()): Promise<FilaProducao> {
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, estadoProducao: 'aberta' },
    select: {
      id: true, numero: true, clienteNome: true, clienteApelido: true, clienteTelefone: true,
      abertaEm: true, prometidaPara: true, versao: true,
      itens: {
        where: { removidoEm: null },
        orderBy: { ordemExibicao: 'asc' },
        select: { descricao: true, quantidade: true, altura: true, largura: true },
      },
    },
  })
  const lista: OrdemDaProducao[] = ordens.map((o) => ({
    id: o.id, numero: o.numero, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
    clienteTelefone: o.clienteTelefone,
    abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null,
    versao: o.versao, itens: o.itens.map(linhaDoItem),
  }))
  return classificarUrgencia(lista, agora)
}
