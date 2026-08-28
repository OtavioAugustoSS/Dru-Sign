import { describe, it, expect } from 'vitest'
import gabarito from './ordem2-gabarito.json'

describe('gabarito do ORDEM2', () => {
  it('tem as 772 linhas do legado', () => {
    expect(gabarito).toHaveLength(772)
  })

  it('toda linha tem os campos esperados', () => {
    for (const l of gabarito) {
      expect(typeof l.os).toBe('number')
      expect(typeof l.altura).toBe('number')
      expect(typeof l.largura).toBe('number')
      expect(typeof l.valor).toBe('number')
      expect(typeof l.quantidade).toBe('number')
      expect(typeof l.total).toBe('number')
    }
  })

  it('contem os casos conhecidos de metro linear', () => {
    const os53 = gabarito.find((l) => l.os === 53 && l.unidadeLegado === 'MTL')
    expect(os53).toBeDefined()
    expect(os53!.altura).toBeCloseTo(0.33, 4)
    expect(os53!.largura).toBeCloseTo(0.27, 4)
    expect(os53!.total).toBeCloseTo(40.8, 2)
  })
})
