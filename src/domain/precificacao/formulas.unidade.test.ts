import { describe, it, expect } from 'vitest'
import { calcularUnidade } from './formulas'

describe('calcularUnidade', () => {
  it.each([
    { os: 1, valorUnitario: 35, quantidade: 1, esperado: '35' },
    { os: 2, valorUnitario: 15, quantidade: 1, esperado: '15' },
    { os: 2, valorUnitario: 13, quantidade: 1, esperado: '13' },
    { os: 3, valorUnitario: 20, quantidade: 1, esperado: '20' },
  ])('OS $os: $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularUnidade({
      unidade: 'unidade',
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('calcula cracha: 18 letras caixa a 34,00', () => {
    const r = calcularUnidade({ unidade: 'unidade', valorUnitario: 34, quantidade: 18 })
    expect(r.total.toString()).toBe('612')
  })

  it('ignora dimensoes quando informadas', () => {
    const r = calcularUnidade({
      unidade: 'unidade', valorUnitario: 10, quantidade: 2, altura: 5, largura: 5,
    })
    expect(r.total.toString()).toBe('20')
    expect(r.medida.toString()).toBe('1')
  })

  it('rejeita quantidade zero', () => {
    expect(() =>
      calcularUnidade({ unidade: 'unidade', valorUnitario: 10, quantidade: 0 }),
    ).toThrow('quantidade precisa ser maior que zero')
  })
})
