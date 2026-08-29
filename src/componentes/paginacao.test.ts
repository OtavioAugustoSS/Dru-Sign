import { describe, expect, it } from 'vitest'
import { lerPagina } from './paginacao'

describe('lerPagina', () => {
  it('le o numero da pagina do endereco', () => {
    expect(lerPagina('2')).toBe(2)
    expect(lerPagina('47')).toBe(47)
  })

  // O parametro vem da barra de endereco: e texto de fora.
  it.each([undefined, '', '0', '1', '-3', 'abc', '2.5', 'Infinity', '1e3000'])(
    'devolve a primeira pagina para %o',
    (valor) => {
      const p = lerPagina(valor)
      expect(Number.isInteger(p)).toBe(true)
      expect(p).toBeGreaterThanOrEqual(1)
    },
  )

  it('nunca devolve algo que quebre o calculo do trecho', () => {
    for (const v of ['0', '-1', 'x', undefined]) {
      expect(lerPagina(v)).toBe(1)
    }
  })
})
