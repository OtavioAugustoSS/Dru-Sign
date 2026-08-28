import { describe, it, expect } from 'vitest'
import { destinoSeguro } from './destino'

describe('destinoSeguro', () => {
  it.each([
    ['/ordens/18461', '/ordens/18461'],
    ['/', '/'],
    ['/entrar?proximo=%2F', '/entrar?proximo=%2F'],
  ])('aceita caminho interno %s', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado)
  })

  it.each([
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['evil.com', '/'],
    ['', '/'],
    [undefined, '/'],
    [null, '/'],
    [42, '/'],
  ])('rejeita %s e devolve o padrao', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado)
  })

  it('aceita outro padrao', () => {
    expect(destinoSeguro(undefined, '/entrar')).toBe('/entrar')
  })
})
