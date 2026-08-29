import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { limitesDoDia } from '@/domain/ordem/datas'
import { resumirOperacao, porAno, type AnoOperacao, type Indicadores, type OrdemMedida } from '@/domain/operacao/indicadores'
import { totalRecebidoPorOrdem } from '@/infra/caixa/resumo'

export interface Operacao {
  indicadores: Indicadores
  anos: AnoOperacao[]
  de: string | null
  ate: string | null
}

/** Nenhum numero daqui e coluna: tudo derivado na leitura, como o eixo de pagamento (spec, secao 9). */
export async function carregarOperacao(empresaId: string, periodo?: { de: string; ate: string }): Promise<Operacao> {
  let filtro = {}
  if (periodo) {
    const limites = limitesDoDia(periodo.de, periodo.ate)
    if (!limites) throw new ErroDeValidacao('período inválido')
    filtro = { abertaEm: { gte: limites.inicio, lt: limites.fim } }
  }
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, ...filtro },
    select: {
      id: true, estadoProducao: true, abertaEm: true, concluidaEm: true, precoFinal: true, responsavelId: true,
      _count: { select: { itens: { where: { removidoEm: null } } } },
    },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, ordens.map((o) => o.id))
  const medidas: OrdemMedida[] = ordens.map((o) => ({
    id: o.id, estadoProducao: o.estadoProducao, abertaEm: o.abertaEm.toISOString(),
    concluidaEm: o.concluidaEm?.toISOString() ?? null, precoFinal: paraDominio(o.precoFinal).toFixed(2),
    totalRecebido: totais.get(o.id) ?? '0.00', temItem: o._count.itens > 0, responsavelId: o.responsavelId,
  }))
  return {
    indicadores: resumirOperacao(medidas),
    anos: porAno(medidas),
    de: periodo?.de ?? null,
    ate: periodo?.ate ?? null,
  }
}
