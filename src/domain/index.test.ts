import { describe, it, expect } from 'vitest'
import { VERSAO_DOMINIO } from './index'

describe('harness', () => {
  it('resolve o alias e roda TypeScript', () => {
    expect(VERSAO_DOMINIO).toBe('1.0.0')
  })
})
