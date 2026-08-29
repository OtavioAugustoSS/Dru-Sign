import { describe, it, expect } from 'vitest'
import { gerarChave } from './chave'

describe('gerarChave', () => {
  it('gera UUID v4 valido e diferente a cada chamada', () => {
    const a = gerarChave()
    const b = gerarChave()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})
