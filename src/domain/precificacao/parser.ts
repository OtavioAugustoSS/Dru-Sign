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

  let valorUnitario: number | undefined
  const mVal = resto.match(RE_VALOR)
  if (mVal?.[1]) {
    valorUnitario = paraNumero(mVal[1])
    resto = resto.slice(0, resto.length - mVal[0].length)
  }

  let altura: number | undefined
  let largura: number | undefined
  const mDim = resto.match(RE_DIMENSAO)
  if (mDim?.[1] && mDim[2]) {
    altura = normalizarDimensao(mDim[1])
    largura = normalizarDimensao(mDim[2])
    resto = resto.replace(mDim[0], ' ')
  }

  const descricao = resto.replace(/\s+/g, ' ').trim()
  const unidadeSugerida: UnidadeCobranca = altura !== undefined ? 'm2' : 'unidade'
  const confianca = valorUnitario !== undefined ? 'alta' : 'parcial'

  return { quantidade, descricao, altura, largura, valorUnitario, unidadeSugerida, confianca }
}
