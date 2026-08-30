import type { UnidadeCobranca } from './tipos'

export interface LinhaInterpretada {
  quantidade: number
  descricao: string
  altura?: number
  largura?: number
  valorUnitario?: number
  unidadeSugerida: UnidadeCobranca
  confianca: 'alta' | 'parcial'
}

const RE_DIMENSAO = /(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX]\s*(\d{1,4}(?:[.,]\d{1,3})?)/
const RE_QUANTIDADE = /^\s*(\d{1,4})\s+(?=\D)/
const RE_VALOR = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}|\d+,\d{2})\s*$/

export function normalizarDimensao(token: string): number {
  const temSeparador = token.includes(',') || token.includes('.')
  const v = Number(token.replace(',', '.'))
  if (Number.isNaN(v)) throw new Error(`dimensao invalida: ${token}`)
  return temSeparador && v < 10 ? v : v / 100
}

function paraNumero(token: string): number {
  return Number(token.replace(/\./g, '').replace(',', '.'))
}

export function interpretarLinha(texto: string): LinhaInterpretada {
  let resto = texto.trim()

  const mQtd = resto.match(RE_QUANTIDADE)
  const quantidade = mQtd?.[1] ? Number(mQtd[1]) : 1
  if (mQtd) resto = resto.slice(mQtd[0].length)

  /*
   * A MEDIDA sai antes do VALOR, e a ordem importa.
   *
   * As duas expressoes disputam o mesmo numero quando a linha termina em
   * medida. Em "acm 3mm branco 1,00 x 0,50" o valor saia primeiro, levava o
   * "0,50" como preco unitario, e a medida ficava sem o segundo lado -- entao
   * sumia. Resultado: a placa custava cinquenta centavos e o preco do catalogo
   * era ignorado, porque so entra quando nao ha valor na linha.
   *
   * Tirando a medida primeiro, os dois casos ficam certos: "01 placa acm 35 x 25
   * e adesivo impresso 30,00", que e como a loja escreve ha catorze anos, segue
   * com medida 35x25 e valor 30,00; e "2 acm 3mm branco 1,00 x 0,50" passa a ser
   * medida 1,00x0,50 com o preco vindo do catalogo, que era a intencao de quem
   * digitou.
   */
  let altura: number | undefined
  let largura: number | undefined
  const mDim = resto.match(RE_DIMENSAO)
  if (mDim?.[1] && mDim[2]) {
    altura = normalizarDimensao(mDim[1])
    largura = normalizarDimensao(mDim[2])
    resto = resto.replace(mDim[0], ' ')
  }

  let valorUnitario: number | undefined
  const mVal = resto.match(RE_VALOR)
  if (mVal?.[1]) {
    valorUnitario = paraNumero(mVal[1])
    resto = resto.slice(0, resto.length - mVal[0].length)
  }

  const descricao = resto.replace(/\s+/g, ' ').trim()
  const unidadeSugerida: UnidadeCobranca = altura !== undefined ? 'm2' : 'unidade'
  const confianca = valorUnitario !== undefined ? 'alta' : 'parcial'

  return { quantidade, descricao, altura, largura, valorUnitario, unidadeSugerida, confianca }
}
