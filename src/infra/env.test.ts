import { describe, it, expect } from 'vitest'
import { validarEnv } from './env'

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/drusign_test',
}

describe('validarEnv', () => {
  it('aceita a configuracao minima', () => {
    const e = validarEnv(base)
    expect(e.NODE_ENV).toBe('test')
    expect(e.DATABASE_URL).toBe(base.DATABASE_URL)
    expect(e.DIRECT_URL).toBeUndefined()
  })

  it('assume development quando NODE_ENV esta vazio', () => {
    expect(validarEnv({ DATABASE_URL: base.DATABASE_URL }).NODE_ENV).toBe('development')
  })

  it('lista todas as faltas de uma vez', () => {
    expect(() => validarEnv({ NODE_ENV: 'palco' })).toThrow(
      /NODE_ENV invalido[\s\S]*DATABASE_URL ausente/,
    )
  })

  it('rejeita DATABASE_URL que nao e postgres', () => {
    expect(() => validarEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/postgresql/)
  })

  it('rejeita DIRECT_URL invalida, mas aceita ausente', () => {
    expect(() => validarEnv({ ...base, DIRECT_URL: 'nao-e-url' })).toThrow(/DIRECT_URL/)
    expect(validarEnv({ ...base, DIRECT_URL: '' }).DIRECT_URL).toBeUndefined()
  })

  it('devolve um objeto congelado', () => {
    expect(Object.isFrozen(validarEnv(base))).toBe(true)
  })
})
