import { describe, it, expect } from 'vitest'
import { dinheiro } from './dinheiro'
import { interpretarMoeda, formatarMoeda } from './moeda'

describe('interpretarMoeda', () => {
  it.each([
    ['281', '281'],
    ['281,00', '281'],
    ['1.234,56', '1234.56'],
    ['R$ 1.234,56', '1234.56'],
    ['1234.56', '1234.56'],
    ['0,5', '0.5'],
    [' 83 ', '83'],
  ])('%s vira %s', (texto, esperado) => {
    expect(interpretarMoeda(texto)?.toString()).toBe(esperado)
  })

  it.each([[''], ['abc'], ['-10'], ['1,2,3'], ['R$']])('%s nao e valor', (texto) => {
    expect(interpretarMoeda(texto)).toBeNull()
  })
})

describe('formatarMoeda', () => {
  it.each([
    ['0', 'R$ 0,00'],
    ['281', 'R$ 281,00'],
    ['1234.5', 'R$ 1.234,50'],
    ['1481', 'R$ 1.481,00'],
    ['207795.4', 'R$ 207.795,40'],
    ['0.0001', 'R$ 0,00'],
  ])('%s vira %s', (valor, esperado) => {
    expect(formatarMoeda(dinheiro(valor))).toBe(esperado)
  })
})
