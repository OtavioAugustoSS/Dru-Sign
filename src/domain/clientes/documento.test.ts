import { describe, it, expect } from 'vitest'
import { normalizarDocumento, formatarDocumento } from './documento'

describe('normalizarDocumento', () => {
  it('reconhece CPF e CNPJ so pelos digitos', () => {
    expect(normalizarDocumento('017.547.961-50')).toEqual({ digitos: '01754796150', tipo: 'cpf' })
    expect(normalizarDocumento('00150991000199')).toEqual({ digitos: '00150991000199', tipo: 'cnpj' })
    expect(normalizarDocumento('00.150.991/0001-99')).toEqual({ digitos: '00150991000199', tipo: 'cnpj' })
  })

  it('rejeita o que nao tem 11 nem 14 digitos', () => {
    expect(normalizarDocumento('')).toBeNull()
    expect(normalizarDocumento('123')).toBeNull()
    expect(normalizarDocumento('39346861028686')).not.toBeNull()
  })
})

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('01754796150')).toBe('017.547.961-50')
    expect(formatarDocumento('00150991000199')).toBe('00.150.991/0001-99')
    expect(formatarDocumento('123')).toBe('123')
  })
})
