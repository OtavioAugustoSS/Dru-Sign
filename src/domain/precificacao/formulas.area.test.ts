import { describe, it, expect } from 'vitest'
import { calcularArea } from './formulas'

describe('calcularArea', () => {
  // Casos extraidos do ORDEM2 do legado, com resultado conhecido e exato.
  it.each([
    { os: 27, altura: 0.2, largura: 0.1,  valorUnitario: 60, quantidade: 100, esperado: '120' },
    { os: 27, altura: 0.2, largura: 0.2,  valorUnitario: 40, quantidade: 50,  esperado: '80' },
    { os: 31, altura: 8.0, largura: 0.12, valorUnitario: 47, quantidade: 2,   esperado: '90.24' },
    { os: 32, altura: 0.7, largura: 0.5,  valorUnitario: 86, quantidade: 2,   esperado: '60.2' },
  ])('OS $os: $altura x $largura a $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularArea({
      unidade: 'm2',
      altura: c.altura,
      largura: c.largura,
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('expoe a area como medida', () => {
    const r = calcularArea({ unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 281, quantidade: 1 })
    expect(r.medida.toString()).toBe('0.48')
    expect(r.unidade).toBe('m2')
  })

  // O legado truncava a terceira casa; nos arredondamos meio para cima.
  // OS 32 do ORDEM2: 0,7 x 1,65 x 83 = 95,865. O legado gravou 95,86; o valor
  // correto e 95,87. Divergencia de um centavo, deliberada e documentada.
  it('arredonda meio para cima, divergindo do truncamento do legado', () => {
    const r = calcularArea({ unidade: 'm2', altura: 0.7, largura: 1.65, valorUnitario: 83, quantidade: 1 })
    expect(r.total.toString()).toBe('95.87')
  })

  it('rejeita item sem altura', () => {
    expect(() =>
      calcularArea({ unidade: 'm2', largura: 0.5, valorUnitario: 10, quantidade: 1 }),
    ).toThrow('Para cobrar por m², informe altura e largura.')
  })

  it('rejeita dimensao zero ou negativa', () => {
    expect(() =>
      calcularArea({ unidade: 'm2', altura: 0, largura: 0.5, valorUnitario: 10, quantidade: 1 }),
    ).toThrow('Altura e largura precisam ser maiores que zero.')
  })
})
