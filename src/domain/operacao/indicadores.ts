import { dinheiro, arredondarCentavos } from '../precificacao/dinheiro'
import type { EstadoProducao } from '../ordem/estados'
import { resumirPagamento } from '../caixa/pagamento'

/** Serializavel: uma linha por ordem, com o total recebido ja somado pela infra. */
export interface OrdemMedida {
  id: string
  estadoProducao: EstadoProducao
  abertaEm: string
  concluidaEm: string | null
  precoFinal: string
  totalRecebido: string
  /** Ordem com pelo menos um item vivo. O legado tinha 0% (spec, secao 11). */
  temItem: boolean
  responsavelId: string
}

export interface Indicadores {
  total: number
  orcamentos: number
  abertas: number
  concluidas: number
  canceladas: number
  /** Fatia de abertas sobre abertas + concluidas, uma casa decimal. Alvo da spec: < 5%. */
  naoFinalizadasPct: string
  /** Soma do saldo das ordens vivas nao pagas. Alvo da spec: ~0. Hoje o legado tem R$ 207.795. */
  valorParado: string
  faturado: string
  recebido: string
  prazoMedianoDias: number | null
  prazoP90Dias: number | null
  /** Fatia de ordens com item estruturado. Alvo da spec: > 90%. */
  comItemPct: string
  /** Quantas pessoas distintas abriram ordem. Alvo da spec: 2 ou mais. */
  pessoas: number
}

const DIA_MS = 86_400_000
/** Orcamento nunca foi para producao e cancelada nao conta contra ninguem. */
const VIVAS: EstadoProducao[] = ['aberta', 'concluida']

function pct(parte: number, todo: number): string {
  return todo === 0 ? '0.0' : ((parte / todo) * 100).toFixed(1)
}

/** Percentil por posicao (nearest-rank), que e o que se explica em voz alta: "9 de 10 saem em ate N dias". */
function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1))
  return ordenados[i] ?? null
}

export function resumirOperacao(ordens: OrdemMedida[]): Indicadores {
  const conta = (e: EstadoProducao) => ordens.filter((o) => o.estadoProducao === e).length
  const vivas = ordens.filter((o) => VIVAS.includes(o.estadoProducao))

  let valorParado = dinheiro(0)
  let faturado = dinheiro(0)
  let recebido = dinheiro(0)
  for (const o of vivas) {
    const r = resumirPagamento(o.precoFinal, [o.totalRecebido])
    valorParado = valorParado.plus(r.saldo)
    faturado = faturado.plus(dinheiro(o.precoFinal))
    recebido = recebido.plus(r.totalRecebido)
  }

  const prazos = ordens
    .filter((o) => o.estadoProducao === 'concluida' && o.concluidaEm !== null)
    .map((o) => Math.round((new Date(o.concluidaEm as string).getTime() - new Date(o.abertaEm).getTime()) / DIA_MS))
    .sort((a, b) => a - b)

  const abertas = conta('aberta')
  const concluidas = conta('concluida')

  return {
    total: ordens.length,
    orcamentos: conta('orcamento'),
    abertas,
    concluidas,
    canceladas: conta('cancelada'),
    naoFinalizadasPct: pct(abertas, abertas + concluidas),
    valorParado: arredondarCentavos(valorParado).toFixed(2),
    faturado: arredondarCentavos(faturado).toFixed(2),
    recebido: arredondarCentavos(recebido).toFixed(2),
    prazoMedianoDias: percentil(prazos, 50),
    prazoP90Dias: percentil(prazos, 90),
    comItemPct: pct(ordens.filter((o) => o.temItem).length, ordens.length),
    pessoas: new Set(ordens.map((o) => o.responsavelId)).size,
  }
}

export interface AnoOperacao {
  ano: number
  /** Ordens vivas do ano: cancelada nao faturou e orcamento ainda nao e venda. */
  ordens: number
  concluidas: number
  faturado: string
  recebido: string
  ticketMedio: string
}

/** Historico ano a ano (spec, tela 9). Ate a Fase 6 importar as 18.443 legadas, so existe o ano corrente. */
export function porAno(ordens: OrdemMedida[]): AnoOperacao[] {
  const anos = new Map<number, OrdemMedida[]>()
  for (const o of ordens) {
    const ano = new Date(o.abertaEm).getUTCFullYear()
    const lista = anos.get(ano)
    if (lista) lista.push(o)
    else anos.set(ano, [o])
  }
  return [...anos.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ano, lista]) => {
      const vivas = lista.filter((o) => VIVAS.includes(o.estadoProducao))
      let faturado = dinheiro(0)
      let recebido = dinheiro(0)
      for (const o of vivas) {
        faturado = faturado.plus(dinheiro(o.precoFinal))
        recebido = recebido.plus(resumirPagamento(o.precoFinal, [o.totalRecebido]).totalRecebido)
      }
      const ticket = vivas.length === 0 ? dinheiro(0) : faturado.dividedBy(vivas.length)
      return {
        ano,
        ordens: vivas.length,
        concluidas: lista.filter((o) => o.estadoProducao === 'concluida').length,
        faturado: arredondarCentavos(faturado).toFixed(2),
        recebido: arredondarCentavos(recebido).toFixed(2),
        ticketMedio: arredondarCentavos(ticket).toFixed(2),
      }
    })
}
