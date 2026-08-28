import { describe, it, expect } from 'vitest'
import { dinheiro, arredondarCentavos, cabeEmNumeric12x4 } from './dinheiro'

describe('dinheiro', () => {
  it('nao sofre o erro classico de ponto flutuante', () => {
    expect(dinheiro(0.1).plus(dinheiro(0.2)).toString()).toBe('0.3')
  })

  it('aceita string e numero', () => {
    expect(dinheiro('120.50').toString()).toBe('120.5')
    expect(dinheiro(120.5).toString()).toBe('120.5')
  })
})

describe('arredondarCentavos', () => {
  it('arredonda para duas casas, meio para cima', () => {
    expect(arredondarCentavos(dinheiro('4.975')).toString()).toBe('4.98')
    expect(arredondarCentavos(dinheiro('4.974')).toString()).toBe('4.97')
  })

  it('preserva valores ja com duas casas', () => {
    expect(arredondarCentavos(dinheiro('40.80')).toString()).toBe('40.8')
  })
})

describe('cabeEmNumeric12x4', () => {
  it.each([['0', true], ['99999999.9999', true], ['-99999999.9999', true], ['100000000', false], ['0.12345', false], ['281', true]])(
    '%s cabe: %s', (valor, esperado) => {
      expect(cabeEmNumeric12x4(dinheiro(valor))).toBe(esperado)
    },
  )
})
