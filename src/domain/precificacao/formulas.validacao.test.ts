import { describe, it, expect } from 'vitest'
import { calcularItem } from './formulas'
import { ErroDeValidacao } from './erros'
import type { ItemCobranca } from './tipos'

const UNIDADE = (valorUnitario: string, quantidade = 1): ItemCobranca =>
  ({ unidade: 'unidade', quantidade, valorUnitario })
const AREA = (valorUnitario: string, quantidade = 1): ItemCobranca =>
  ({ unidade: 'm2', quantidade, valorUnitario, altura: '0.60', largura: '0.80' })
const LINEAR = (valorUnitario: string, quantidade = 1): ItemCobranca =>
  ({ unidade: 'metro_linear', quantidade, valorUnitario, altura: '0.60', largura: '0.80' })

/**
 * Item com valor negativo abaixa o preco final sem passar pelo ajuste manual —
 * ou seja, sem motivo e sem quem ajustou. O desconto tem um caminho so: ajustarPreco.
 */
describe('calcularItem recusa valor unitario negativo', () => {
  it.each([
    ['unidade', UNIDADE('-61.00')],
    ['m2', AREA('-120.50')],
    ['metro_linear', LINEAR('-93.00')],
  ])('%s', (_unidade: string, item: ItemCobranca) => {
    expect(() => calcularItem(item)).toThrow(ErroDeValidacao)
  })

  it('aceita item de cortesia a zero', () => {
    expect(calcularItem(UNIDADE('0.00')).total.toFixed(2)).toBe('0.00')
  })
})

describe('calcularItem exige quantidade maior que zero em todas as unidades', () => {
  it.each([
    ['unidade', UNIDADE('61.00', 0)],
    ['m2', AREA('120.50', 0)],
    ['metro_linear', LINEAR('93.00', -2)],
  ])('%s', (_unidade: string, item: ItemCobranca) => {
    expect(() => calcularItem(item)).toThrow(ErroDeValidacao)
  })
})
