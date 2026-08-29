import { describe, it, expect } from 'vitest'
import { dinheiro } from '../precificacao/dinheiro'
import { descreverCobranca, formatarDimensao, tituloDocumento, type ItemImpresso } from './impresso'

function item(p: Partial<ItemImpresso>): ItemImpresso {
  return { quantidade: 1, descricao: 'x', unidade: 'unidade', altura: null, largura: null, valorUnitario: dinheiro(1), total: dinheiro(1), ...p }
}

describe('descreverCobranca', () => {
  it('area soma a quantidade: 6 x 0,60 x 0,80 = 2,88 m2', () => {
    expect(descreverCobranca(item({ unidade: 'm2', quantidade: 6, altura: 0.6, largura: 0.8 }))).toBe('área · 2,88 m²')
  })
  it('metro linear e perimetro', () => {
    expect(descreverCobranca(item({ unidade: 'metro_linear', altura: 0.61, largura: 0.6 }))).toBe('metro linear · perímetro 2,42 m')
  })
  it('unidade com medida registrada (OS 18449) continua por unidade', () => {
    expect(descreverCobranca(item({ unidade: 'unidade', quantidade: 12, altura: 0.61, largura: 0.4 }))).toBe('por unidade')
  })
})

describe('formatarDimensao e tituloDocumento', () => {
  it('0,61 × 0,40 m; sem medida e travessao', () => {
    expect(formatarDimensao(0.61, 0.4)).toBe('0,61 × 0,40 m')
    expect(formatarDimensao(null, null)).toBe('—')
  })
  it('orcamento tem titulo proprio', () => {
    expect(tituloDocumento('orcamento')).toBe('Orçamento')
    expect(tituloDocumento('aberta')).toBe('Ordem de Serviço')
  })
})
