import { describe, it, expect } from 'vitest'
import { normalizarTelefone, formatarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  it.each([
    ['(38)9968-1168', '38999681168', true],
    ['(38)9111-4491', '38991114491', true],
    ['(38)3676-6222', '3836766222', false],
    ['38999681168', '38999681168', false],
    ['(38) 99968-1168', '38999681168', false],
    ['9968-1168', '38999681168', true],
    ['3676-6222', '3836766222', true],
  ])('%s vira %s (inferido: %s)', (original, normalizado, inferido) => {
    expect(normalizarTelefone(original)).toEqual({ normalizado, inferido })
  })

  it.each([
    ['(  )    -'],
    [''],
    ['123'],
    ['(38)1234-5678'],
    ['(38)0000-0000'],
    ['(08)9968-1168'],
    ['03899681168'],
  ])('%s nao e discavel', (original) => {
    expect(normalizarTelefone(original)).toEqual({ normalizado: null, inferido: false })
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('38999681168')).toBe('(38) 99968-1168')
    expect(formatarTelefone('3836766222')).toBe('(38) 3676-6222')
  })

  it('devolve o que recebeu quando nao reconhece', () => {
    expect(formatarTelefone('123')).toBe('123')
  })
})
