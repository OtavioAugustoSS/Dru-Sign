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

export function calcularUnidade(item: ItemCobranca): ResultadoItem {
  if (item.quantidade <= 0) {
    throw new Error('quantidade precisa ser maior que zero')
  }
  const total = arredondarCentavos(
    dinheiro(item.valorUnitario).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'unidade', medida: dinheiro(1), total }
}

export function calcularMetroLinear(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new Error('altura e largura sao obrigatorias para cobranca por metro linear')
  }
  if (item.altura <= 0 || item.largura <= 0) {
    throw new Error('altura e largura precisam ser maiores que zero')
  }
  const medida = dinheiro(item.altura).plus(dinheiro(item.largura)).times(2)
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'metro_linear', medida, total }
}

export function calcularItem(item: ItemCobranca): ResultadoItem {
  switch (item.unidade) {
    case 'm2':
      return calcularArea(item)
    case 'unidade':
      return calcularUnidade(item)
    case 'metro_linear':
      return calcularMetroLinear(item)
  }
}
