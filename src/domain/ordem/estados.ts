import { dinheiro } from '../precificacao/dinheiro'

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
  precoFinal: number,
  recebimentos: number[],
): EstadoPagamento {
  const total = dinheiro(precoFinal)
  const recebido = recebimentos.reduce((s, r) => s.plus(dinheiro(r)), dinheiro(0))

  if (total.lessThanOrEqualTo(0)) return 'pago'
  if (recebido.lessThanOrEqualTo(0)) return 'nao_pago'
  if (recebido.greaterThanOrEqualTo(total.minus(TOLERANCIA))) return 'pago'
  return 'parcial'
}
