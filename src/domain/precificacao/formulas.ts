import { dinheiro, arredondarCentavos } from './dinheiro'
import { ErroDeValidacao } from './erros'
import type { ItemCobranca, ResultadoItem } from './tipos'

/**
 * O que vale para qualquer unidade. Valor negativo abaixaria o preco final por fora
 * do ajuste manual — sem motivo e sem quem ajustou; desconto tem um caminho so.
 * Zero e legitimo: item de cortesia.
 */
function validarComum(item: ItemCobranca): void {
  if (item.quantidade <= 0) {
    throw new ErroDeValidacao('A quantidade precisa ser maior que zero.')
  }
  if (dinheiro(item.valorUnitario).lt(0)) {
    throw new ErroDeValidacao('O valor unitário não pode ser negativo.')
  }
}

export function calcularArea(item: ItemCobranca): ResultadoItem {
  validarComum(item)
  if (item.altura === undefined || item.largura === undefined) {
    throw new ErroDeValidacao('Para cobrar por m², informe altura e largura.')
  }
  if (dinheiro(item.altura).lte(0) || dinheiro(item.largura).lte(0)) {
    throw new ErroDeValidacao('Altura e largura precisam ser maiores que zero.')
  }
  const medida = dinheiro(item.altura).times(dinheiro(item.largura))
  const total = arredondarCentavos(
    medida.times(dinheiro(item.valorUnitario)).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'm2', medida, total }
}

export function calcularUnidade(item: ItemCobranca): ResultadoItem {
  validarComum(item)
  const total = arredondarCentavos(
    dinheiro(item.valorUnitario).times(dinheiro(item.quantidade)),
  )
  return { unidade: 'unidade', medida: dinheiro(1), total }
}

export function calcularMetroLinear(item: ItemCobranca): ResultadoItem {
  validarComum(item)
  if (item.altura === undefined || item.largura === undefined) {
    throw new ErroDeValidacao('Para cobrar por metro linear, informe altura e largura.')
  }
  if (dinheiro(item.altura).lte(0) || dinheiro(item.largura).lte(0)) {
    throw new ErroDeValidacao('Altura e largura precisam ser maiores que zero.')
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
