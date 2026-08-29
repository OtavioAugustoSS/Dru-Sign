import { dinheiro, arredondarCentavos } from './dinheiro'
import { ErroDeValidacao } from './erros'
import type { ItemCobranca, ResultadoItem } from './tipos'

export function calcularArea(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new ErroDeValidacao('altura e largura sao obrigatorias para cobranca por m2')
  }
  if (dinheiro(item.altura).lte(0) || dinheiro(item.largura).lte(0)) {
    throw new ErroDeValidacao('altura e largura precisam ser maiores que zero')
  }
  const medida = dinheiro(item.altura).times(dinheiro(item.largura))
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'm2', medida, total }
}

export function calcularUnidade(item: ItemCobranca): ResultadoItem {
  if (item.quantidade <= 0) {
    throw new ErroDeValidacao('quantidade precisa ser maior que zero')
  }
  const total = arredondarCentavos(
    dinheiro(item.valorUnitario).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'unidade', medida: dinheiro(1), total }
}

export function calcularMetroLinear(item: ItemCobranca): ResultadoItem {
  if (item.altura === undefined || item.largura === undefined) {
    throw new ErroDeValidacao('altura e largura sao obrigatorias para cobranca por metro linear')
  }
  if (dinheiro(item.altura).lte(0) || dinheiro(item.largura).lte(0)) {
    throw new ErroDeValidacao('altura e largura precisam ser maiores que zero')
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
