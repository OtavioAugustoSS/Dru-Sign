import { describe, it, expect } from 'vitest'
import { comporOrdem } from './ordem'
import type { ItemCobranca } from './tipos'

describe('comporOrdem', () => {
  it('soma itens e acrescimos', () => {
    const itens: ItemCobranca[] = [
      { unidade: 'm2', altura: 0.6, largura: 0.8, valorUnitario: 120.5, quantidade: 6 },
      { unidade: 'm2', altura: 0.51, largura: 0.61, valorUnitario: 76, quantidade: 3 },
      { unidade: 'unidade', valorUnitario: 34, quantidade: 18 },
      { unidade: 'metro_linear', altura: 0.61, largura: 0.6, valorUnitario: 28, quantidade: 1 },
    ]
    const acrescimos = [
      { tipo: 'instalacao', descricao: 'Instalacao', valor: 280 },
      { tipo: 'deslocamento', descricao: '34 km', valor: 102 },
    ]
    // 347,04 + 70,93 + 612,00 + 67,76 = 1.097,73
    const c = comporOrdem(itens, acrescimos)
    expect(c.subtotalItens.toString()).toBe('1097.73')
    expect(c.subtotalAcrescimos.toString()).toBe('382')
    expect(c.precoCalculado.toString()).toBe('1479.73')
    expect(c.precoFinal.toString()).toBe('1479.73')
    expect(c.temAjuste).toBe(false)
  })

  it('aplica desconto como ajuste manual', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 1000, quantidade: 2 }]
    const c = comporOrdem(itens, [], 1950)
    expect(c.precoCalculado.toString()).toBe('2000')
    expect(c.precoFinal.toString()).toBe('1950')
    expect(c.ajuste.toString()).toBe('-50')
    expect(c.temAjuste).toBe(true)
  })

  it('aceita ajuste para cima', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    const c = comporOrdem(itens, [], 130)
    expect(c.ajuste.toString()).toBe('30')
    expect(c.temAjuste).toBe(true)
  })

  it('nao marca ajuste quando o valor manual iguala o calculado', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    const c = comporOrdem(itens, [], 100)
    expect(c.temAjuste).toBe(false)
    expect(c.ajuste.toString()).toBe('0')
  })

  it('ordem vazia vale zero', () => {
    const c = comporOrdem([], [])
    expect(c.precoCalculado.toString()).toBe('0')
    expect(c.precoFinal.toString()).toBe('0')
  })

  it('rejeita preco final negativo', () => {
    const itens: ItemCobranca[] = [{ unidade: 'unidade', valorUnitario: 100, quantidade: 1 }]
    expect(() => comporOrdem(itens, [], -10)).toThrow('O preço final não pode ser negativo.')
  })
})
