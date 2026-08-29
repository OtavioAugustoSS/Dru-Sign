import { describe, expect, it } from 'vitest'
import { emPercentual } from './percentual'

describe('emPercentual', () => {
  // O dominio devolve string com ponto; a tela mostrava esse ponto cru.
  it('usa virgula, que e o separador decimal em portugues', () => {
    expect(emPercentual('75.2')).toBe('75,2%')
    expect(emPercentual('82.4')).toBe('82,4%')
    expect(emPercentual('0.0')).toBe('0,0%')
  })

  it('mantem sempre uma casa, para a coluna nao dancar', () => {
    expect(emPercentual('100')).toBe('100,0%')
    expect(emPercentual(5)).toBe('5,0%')
  })

  it('nao inventa numero quando nao ha numero', () => {
    expect(emPercentual('')).toBe('—')
    expect(emPercentual('n/d')).toBe('—')
  })
})
