import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { lerDataCalendario, limitesDoDia } from '@/domain/ordem/datas'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { EstadoProducao } from '@/domain/ordem/estados'

/**
 * Tudo o que o painel mostra, numa leitura so.
 *
 * A tela junta o que estava espalhado em seis lugares: faturamento, caixa,
 * producao, cobranca, clientes e o arquivo do sistema antigo. Cada numero aqui
 * tem um destino na tela -- se um numero nao leva a lugar nenhum, ele nao devia
 * estar no painel.
 *
 * As series mes a mes saem de SQL cru: o `groupBy` do Prisma agrupa por coluna,
 * e "por mes" e uma funcao sobre a coluna. Todas as datas sao truncadas no fuso
 * da loja, senao a venda das 22h cai no mes seguinte.
 */

const FUSO = 'America/Sao_Paulo'
/** Cancelada nao faturou; orcamento ainda nao e venda. */
const FATURAM: EstadoProducao[] = ['aberta', 'concluida']

export interface PontoMes {
  /** 'AAAA-MM'. */
  mes: string
  valor: string
}

export interface EntradaSaidaMes {
  mes: string
  entrada: string
  saida: string
}

export interface Ranking {
  id: string | null
  nome: string
  valor: string
  quantidade: number
}

export interface Painel {
  de: string
  ate: string
  /** Faturado: soma do preco final das ordens abertas no periodo. */
  faturado: string
  /** Recebido de verdade: entradas do livro-caixa no periodo. */
  recebido: string
  saidas: string
  saldoCaixa: string
  /** Faturado que ainda nao entrou, em TODAS as ordens vivas -- nao so no periodo. */
  aReceber: string
  ordensNoPeriodo: number
  porEstado: Record<EstadoProducao, number>
  /** Concluidas com saldo, de qualquer epoca: e a fila de cobranca. */
  aCobrar: number
  /** Abertas com entrega prometida para tras. */
  atrasadas: number
  /** Doze meses ate o fim do periodo. */
  faturamentoMensal: PontoMes[]
  caixaMensal: EntradaSaidaMes[]
  /** Doze anos do arquivo do sistema antigo, para a aba do passado. */
  arquivoAnual: PontoMes[]
  melhoresClientes: Ranking[]
  despesasPorConta: Ranking[]
}

function primeiroDiaDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`
}

/** 'AAAA-MM' dos doze meses que terminam no mes de `ate`, do mais antigo ao mais novo. */
function ultimosDozeMeses(ate: string): string[] {
  const [ano, mes] = ate.split('-').map(Number) as [number, number]
  const meses: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1))
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

function comoTexto(v: unknown): string {
  return v === null || v === undefined ? '0.00' : dinheiro(String(v)).toFixed(2)
}

export async function carregarPainel(empresaId: string, periodo: { de: string; ate: string }): Promise<Painel> {
  const de = lerDataCalendario(periodo.de)
  const ate = lerDataCalendario(periodo.ate)
  if (!de || !ate || de.getTime() > ate.getTime()) throw new ErroDeValidacao('Período inválido.')
  const janela = limitesDoDia(periodo.de, periodo.ate)
  if (!janela) throw new ErroDeValidacao('Período inválido.')

  const meses = ultimosDozeMeses(periodo.ate)
  const inicioSerie = lerDataCalendario(`${meses[0]}-01`) as Date
  const janelaSerie = limitesDoDia(`${meses[0]}-01`, periodo.ate)

  const [
    ordensDoPeriodo,
    porEstado,
    aCobrarLinhas,
    atrasadas,
    caixaPeriodo,
    aReceberLinhas,
    serieFaturamento,
    serieCaixa,
    serieArquivo,
    clientes,
    despesas,
  ] = await Promise.all([
    prisma.ordemServico.aggregate({
      where: { empresaId, estadoProducao: { in: FATURAM }, abertaEm: { gte: janela.inicio, lt: janela.fim } },
      _sum: { precoFinal: true },
      _count: { _all: true },
    }),
    prisma.ordemServico.groupBy({
      by: ['estadoProducao'],
      where: { empresaId, abertaEm: { gte: janela.inicio, lt: janela.fim } },
      _count: { _all: true },
    }),
    // A cobrar e a receber olham TODAS as ordens vivas: dinheiro parado nao
    // some porque o periodo escolhido na tela nao alcanca a ordem.
    prisma.$queryRaw<Array<{ n: bigint; total: unknown }>>`
      SELECT COUNT(*)::bigint AS n, COALESCE(SUM(o.preco_final - COALESCE(r.recebido, 0)), 0) AS total
      FROM ordem_servico o
      LEFT JOIN (
        SELECT ordem_id, SUM(valor) AS recebido FROM recebimento
        WHERE empresa_id = ${empresaId}::uuid AND estornado_em IS NULL GROUP BY ordem_id
      ) r ON r.ordem_id = o.id
      WHERE o.empresa_id = ${empresaId}::uuid
        AND o.estado_producao = 'concluida'
        AND o.preco_final - COALESCE(r.recebido, 0) > 0`,
    prisma.ordemServico.count({
      where: { empresaId, estadoProducao: 'aberta', prometidaPara: { lt: new Date() } },
    }),
    prisma.lancamentoCaixa.groupBy({
      by: ['tipo'],
      where: { empresaId, estornadoEm: null, data: { gte: de, lte: ate } },
      _sum: { valor: true },
    }),
    prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COALESCE(SUM(o.preco_final - COALESCE(r.recebido, 0)), 0) AS total
      FROM ordem_servico o
      LEFT JOIN (
        SELECT ordem_id, SUM(valor) AS recebido FROM recebimento
        WHERE empresa_id = ${empresaId}::uuid AND estornado_em IS NULL GROUP BY ordem_id
      ) r ON r.ordem_id = o.id
      WHERE o.empresa_id = ${empresaId}::uuid
        AND o.estado_producao IN ('aberta', 'concluida')
        AND o.preco_final - COALESCE(r.recebido, 0) > 0`,
    prisma.$queryRaw<Array<{ mes: string; total: unknown }>>`
      SELECT to_char(date_trunc('month', aberta_em AT TIME ZONE ${FUSO}), 'YYYY-MM') AS mes,
             COALESCE(SUM(preco_final), 0) AS total
      FROM ordem_servico
      WHERE empresa_id = ${empresaId}::uuid
        AND estado_producao IN ('aberta', 'concluida')
        AND aberta_em >= ${janelaSerie?.inicio ?? inicioSerie}
        AND aberta_em < ${janela.fim}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ mes: string; tipo: string; total: unknown }>>`
      SELECT to_char(date_trunc('month', data), 'YYYY-MM') AS mes, tipo::text AS tipo,
             COALESCE(SUM(valor), 0) AS total
      FROM lancamento_caixa
      WHERE empresa_id = ${empresaId}::uuid AND estornado_em IS NULL
        AND data >= ${inicioSerie} AND data <= ${ate}
      GROUP BY 1, 2 ORDER BY 1`,
    prisma.$queryRaw<Array<{ ano: string; total: unknown }>>`
      SELECT to_char(date_trunc('year', data_entrada), 'YYYY') AS ano, COALESCE(SUM(total), 0) AS total
      FROM ordem_legado
      WHERE empresa_id = ${empresaId}::uuid AND nome_destruido = false
      GROUP BY 1 ORDER BY 1`,
    prisma.ordemServico.groupBy({
      by: ['clienteId'],
      where: {
        empresaId, estadoProducao: { in: FATURAM },
        abertaEm: { gte: janela.inicio, lt: janela.fim },
        clienteId: { not: null },
      },
      _sum: { precoFinal: true },
      _count: { _all: true },
      orderBy: { _sum: { precoFinal: 'desc' } },
      take: 8,
    }),
    prisma.lancamentoCaixa.groupBy({
      by: ['contaId'],
      where: { empresaId, tipo: 'saida', estornadoEm: null, data: { gte: de, lte: ate } },
      _sum: { valor: true },
      _count: { _all: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 8,
    }),
  ])

  const somaCaixa = (t: 'entrada' | 'saida') => comoTexto(caixaPeriodo.find((g) => g.tipo === t)?._sum.valor)
  const recebido = somaCaixa('entrada')
  const saidas = somaCaixa('saida')

  const nomesDeClientes = await prisma.cliente.findMany({
    where: { id: { in: clientes.map((c) => c.clienteId as string) } },
    select: { id: true, nome: true, apelido: true },
  })
  const porId = new Map(nomesDeClientes.map((c) => [c.id, c.apelido || c.nome]))

  const contas = await prisma.contaPlano.findMany({
    where: { id: { in: despesas.map((d) => d.contaId) } },
    select: { id: true, nome: true },
  })
  const contaPorId = new Map(contas.map((c) => [c.id, c.nome]))

  const estados: Record<EstadoProducao, number> = { orcamento: 0, aberta: 0, concluida: 0, cancelada: 0 }
  for (const g of porEstado) estados[g.estadoProducao] = g._count._all

  const faturamentoPorMes = new Map(serieFaturamento.map((l) => [l.mes, comoTexto(l.total)]))
  const caixaPorMes = new Map<string, { entrada: string; saida: string }>()
  for (const l of serieCaixa) {
    const atual = caixaPorMes.get(l.mes) ?? { entrada: '0.00', saida: '0.00' }
    caixaPorMes.set(l.mes, { ...atual, [l.tipo === 'entrada' ? 'entrada' : 'saida']: comoTexto(l.total) })
  }

  return {
    de: periodo.de,
    ate: periodo.ate,
    faturado: comoTexto(ordensDoPeriodo._sum.precoFinal),
    recebido,
    saidas,
    saldoCaixa: dinheiro(recebido).minus(dinheiro(saidas)).toFixed(2),
    aReceber: comoTexto(aReceberLinhas[0]?.total),
    ordensNoPeriodo: ordensDoPeriodo._count._all,
    porEstado: estados,
    aCobrar: Number(aCobrarLinhas[0]?.n ?? 0),
    atrasadas,
    // Mes sem venda entra com zero: sem isso a serie pula o mes e o eixo mente
    // sobre a distancia entre um ponto e outro.
    faturamentoMensal: meses.map((mes) => ({ mes, valor: faturamentoPorMes.get(mes) ?? '0.00' })),
    caixaMensal: meses.map((mes) => ({
      mes,
      entrada: caixaPorMes.get(mes)?.entrada ?? '0.00',
      saida: caixaPorMes.get(mes)?.saida ?? '0.00',
    })),
    arquivoAnual: serieArquivo.map((l) => ({ mes: l.ano, valor: comoTexto(l.total) })),
    melhoresClientes: clientes.map((c) => ({
      id: c.clienteId,
      nome: porId.get(c.clienteId as string) ?? 'Sem nome',
      valor: comoTexto(c._sum.precoFinal),
      quantidade: c._count._all,
    })),
    despesasPorConta: despesas.map((d) => ({
      id: d.contaId,
      nome: contaPorId.get(d.contaId) ?? 'Conta removida',
      valor: comoTexto(d._sum.valor),
      quantidade: d._count._all,
    })),
  }
}

export { primeiroDiaDoMes }
