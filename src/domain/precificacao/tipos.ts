import type { Decimal } from './dinheiro'

export type UnidadeCobranca = 'm2' | 'unidade' | 'metro_linear'

export interface ItemCobranca {
  unidade: UnidadeCobranca
  quantidade: number
  valorUnitario: number
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  altura?: number
  /** Em metros. Obrigatorio para m2 e metro_linear. */
  largura?: number
}

export interface ResultadoItem {
  unidade: UnidadeCobranca
  /** Area em m2, perimetro em metros, ou 1 para cobranca por unidade. */
  medida: Decimal
  total: Decimal
}
