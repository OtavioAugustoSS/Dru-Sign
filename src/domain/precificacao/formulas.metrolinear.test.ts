import { describe, it, expect } from 'vitest'
import { calcularMetroLinear } from './formulas'

describe('calcularMetroLinear', () => {
  // As cinco linhas MTL do ORDEM2 com dimensao preenchida que fecham exatamente.
  it.each([
    { os: 31, altura: 0.78,  largura: 0.028, valorUnitario: 19,   quantidade: 1, perimetro: '1.616', esperado: '30.7' },
    { os: 53, altura: 0.33,  largura: 0.27,  valorUnitario: 34,   quantidade: 1, perimetro: '1.2',   esperado: '40.8' },
    { os: 58, altura: 0.025, largura: 0.03,  valorUnitario: 35,   quantidade: 4, perimetro: '0.11',  esperado: '15.4' },
    { os: 84, altura: 0.05,  largura: 0.03,  valorUnitario: 62.5, quantidade: 1, perimetro: '0.16',  esperado: '10' },
    { os: 98, altura: 0.015, largura: 0.056, valorUnitario: 35,   quantidade: 1, perimetro: '0.142', esperado: '4.97' },
  ])('OS $os: perimetro $perimetro a $valorUnitario x $quantidade = $esperado', (c) => {
    const r = calcularMetroLinear({
      unidade: 'metro_linear',
      altura: c.altura,
      largura: c.largura,
      valorUnitario: c.valorUnitario,
      quantidade: c.quantidade,
    })
    expect(r.medida.toString()).toBe(c.perimetro)
    expect(r.total.toString()).toBe(c.esperado)
  })

  it('calcula o perfil de aluminio de uma placa 0,61 x 0,60', () => {
    const r = calcularMetroLinear({
      unidade: 'metro_linear', altura: 0.61, largura: 0.6, valorUnitario: 28, quantidade: 1,
    })
    expect(r.medida.toString()).toBe('2.42')
    expect(r.total.toString()).toBe('67.76')
  })

  it('rejeita item sem dimensao', () => {
    expect(() =>
      calcularMetroLinear({ unidade: 'metro_linear', valorUnitario: 28, quantidade: 1 }),
    ).toThrow('altura e largura sao obrigatorias para cobranca por metro linear')
  })
})
