import type { Decimal } from './dinheiro'

export type UnidadeCobranca = 'm2' | 'unidade' | 'metro_linear'

/** number vindo do formulario; string exata (Decimal.toFixed()) vindo do banco. Nunca passa por float. */
export type ValorNumerico = number | string

export interface ItemCobranca {
  unidade: UnidadeCobranca
  quantidade: number
  valorUnitario: ValorNumerico
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  altura?: ValorNumerico
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  largura?: ValorNumerico
  /**
   * Minimo cobravel da familia, em m2 ou metros lineares. Peca menor que isso e cobrada
   * como se tivesse o minimo. Ausente: sem minimo, que e como o sistema sempre calculou.
   */
  minimoMedida?: ValorNumerico
}

export interface ResultadoItem {
  unidade: UnidadeCobranca
  /** Area em m2, perimetro em metros, ou 1 para cobranca por unidade. */
  medida: Decimal
  total: Decimal
}
