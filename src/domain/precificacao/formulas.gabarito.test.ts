import { describe, it, expect } from 'vitest'
import { calcularItem } from './formulas'
import gabarito from './__fixtures__/ordem2-gabarito.json'

/** OS 28 e a unica linha MTL dimensionada que nao fecha: o legado gravou 6,00
 *  onde a formula da 1,62. Fica registrada como divergencia conhecida. */
const DIVERGENCIAS_CONHECIDAS = new Set([28])

describe('calcularItem — seletor', () => {
  it('escolhe a formula de area', () => {
    const r = calcularItem({ unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 281, quantidade: 1 })
    expect(r.unidade).toBe('m2')
    expect(r.total.toString()).toBe('134.88')
  })

  it('escolhe a formula de unidade', () => {
    const r = calcularItem({ unidade: 'unidade', valorUnitario: 20, quantidade: 3 })
    expect(r.total.toString()).toBe('60')
  })

  it('escolhe a formula de metro linear', () => {
    const r = calcularItem({ unidade: 'metro_linear', altura: 0.33, largura: 0.27, valorUnitario: 34, quantidade: 1 })
    expect(r.total.toString()).toBe('40.8')
  })
})

describe('regressao contra o gabarito do legado', () => {
  // `quantidade > 0` em todos: o legado gravou 9 linhas com quantidade zero (uma delas de
  // area, a OS 532, tambem com valor e total zerados) — linha vazia, sem preco a conferir.
  const porArea = gabarito.filter(
    (l) => l.totmt > 0 && l.unidadeLegado === 'MT2' && l.altura > 0 && l.largura > 0 && l.quantidade > 0,
  )
  const porUnidade = gabarito.filter((l) => l.totmt === 0 && l.valor > 0 && l.quantidade > 0)
  const porPerimetro = gabarito.filter(
    (l) =>
      ['MTL', 'MT', 'ML'].includes(l.unidadeLegado) &&
      l.altura > 0 && l.largura > 0 && l.totmt > 0 && l.quantidade > 0,
  )

  it('reproduz ao menos 90% das linhas de area', () => {
    let ok = 0
    for (const l of porArea) {
      const r = calcularItem({
        unidade: 'm2', altura: l.altura, largura: l.largura,
        valorUnitario: l.valor, quantidade: l.quantidade,
      })
      if (r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)) ok++
    }
    expect(ok / porArea.length).toBeGreaterThanOrEqual(0.9)
  })

  it('reproduz 100% das linhas por unidade', () => {
    for (const l of porUnidade) {
      const r = calcularItem({ unidade: 'unidade', valorUnitario: l.valor, quantidade: l.quantidade })
      expect(r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)).toBe(true)
    }
  })

  it('reproduz todas as linhas de perimetro, exceto as divergencias conhecidas', () => {
    for (const l of porPerimetro) {
      if (DIVERGENCIAS_CONHECIDAS.has(l.os)) continue
      const r = calcularItem({
        unidade: 'metro_linear', altura: l.altura, largura: l.largura,
        valorUnitario: l.valor, quantidade: l.quantidade,
      })
      expect(r.total.minus(l.total).abs().lessThanOrEqualTo(0.01)).toBe(true)
    }
  })
})
