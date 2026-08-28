import { dinheiro, arredondarCentavos } from './dinheiro'
import type { ItemCobranca, ResultadoItem } from './tipos'

export function calcularArea(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new Error('altura e largura sao obrigatorias para cobranca por m2')
  }
  if (item.altura <= 0 || item.largura <= 0) {
    throw new Error('altura e largura precisam ser maiores que zero')
  }
  const medida = dinheiro(item.altura).times(dinheiro(item.largura))
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'm2', medida, total }
}
