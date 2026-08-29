import { dinheiro } from '../precificacao/dinheiro'
import type { ValorNumerico } from '../precificacao/tipos'

export type EstadoProducao = 'orcamento' | 'aberta' | 'concluida' | 'cancelada'
export type EstadoPagamento = 'nao_pago' | 'parcial' | 'pago'

const TRANSICOES: Record<EstadoProducao, readonly EstadoProducao[]> = {
  orcamento: ['aberta', 'cancelada'],
  aberta: ['concluida', 'cancelada'],
  concluida: ['cancelada'],
  cancelada: [],
}

export function podeTransicionar(de: EstadoProducao, para: EstadoProducao): boolean {
  return TRANSICOES[de].includes(para)
}

export function transicionar(de: EstadoProducao, para: EstadoProducao): EstadoProducao {
  if (!podeTransicionar(de, para)) {
    throw new Error(`transicao invalida: ${de} -> ${para}`)
  }
  return para
}

/** Tolerancia de um centavo, para nao deixar ordem eternamente "parcial"
 *  por diferenca de arredondamento em pagamento dividido. */
const TOLERANCIA = dinheiro('0.01')

export function calcularEstadoPagamento(
  precoFinal: ValorNumerico,
  recebimentos: ValorNumerico[],
): EstadoPagamento {
  const total = dinheiro(precoFinal)
  const recebido = recebimentos.reduce((s, r) => s.plus(dinheiro(r)), dinheiro(0))

  if (total.lessThanOrEqualTo(0)) return 'pago'
  if (recebido.lessThanOrEqualTo(0)) return 'nao_pago'
  if (recebido.greaterThanOrEqualTo(total.minus(TOLERANCIA))) return 'pago'
  return 'parcial'
}

export const ROTULO_ESTADO: Record<EstadoProducao, string> = {
  orcamento: 'Orçamento',
  aberta: 'Aberta',
  concluida: 'Serviço finalizado',
  cancelada: 'Cancelada',
}

export interface PermissoesOrdem {
  editarCabecalho: boolean
  editarItens: boolean
  editarPreco: boolean
  editarObservacoes: boolean
  aprovarOrcamento: boolean
  cancelar: boolean
  /** "Servico finalizado": so de aberta; nao toca em dinheiro. */
  concluir: boolean
  /** Receber (e "Concluir e receber" quando ainda aberta). */
  receber: boolean
}

/** O que a tela deixa mexer em cada estado. */
export function permissoes(estado: EstadoProducao): PermissoesOrdem {
  const emEdicao = estado === 'orcamento' || estado === 'aberta'
  return {
    editarCabecalho: emEdicao,
    editarItens: emEdicao,
    editarPreco: emEdicao,
    editarObservacoes: estado !== 'cancelada',
    aprovarOrcamento: estado === 'orcamento',
    cancelar: emEdicao,
    concluir: estado === 'aberta',
    receber: estado === 'aberta' || estado === 'concluida',
  }
}

export interface SituacaoAjuste {
  temAjuste: boolean
  precoCalculado: string
  precoCalculadoNoAjuste: string | null
}

/** O aviso "o calculado mudou e o preco final continua o ajustado" — derivado, nunca digitado. */
export function ajusteDesatualizado(s: SituacaoAjuste): boolean {
  return s.temAjuste && s.precoCalculadoNoAjuste !== null && s.precoCalculadoNoAjuste !== s.precoCalculado
}
