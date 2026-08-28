import { describe, it, expect } from 'vitest'
import { interpretarLinha, normalizarDimensao } from './parser'

describe('normalizarDimensao', () => {
  // Regra: token com separador decimal e valor < 10 ja esta em metros;
  // caso contrario esta em centimetros.
  it.each([
    ['0,61', 0.61],
    ['0.61', 0.61],
    ['1,35', 1.35],
    ['61', 0.61],
    ['40', 0.4],
    ['150', 1.5],
    ['8', 0.08],
  ])('%s vira %s metros', (entrada, esperado) => {
    expect(normalizarDimensao(entrada)).toBeCloseTo(esperado, 4)
  })
})

describe('interpretarLinha', () => {
  it('interpreta o caso canonico com dimensao em centimetros', () => {
    const r = interpretarLinha('12 placas ACM 61x40 61,00')
    expect(r.quantidade).toBe(12)
    expect(r.descricao).toBe('placas ACM')
    expect(r.altura).toBeCloseTo(0.61, 4)
    expect(r.largura).toBeCloseTo(0.4, 4)
    expect(r.valorUnitario).toBe(61)
    expect(r.unidadeSugerida).toBe('m2')
    expect(r.confianca).toBe('alta')
  })

  it('aceita dimensao em metros', () => {
    const r = interpretarLinha('2 adesivo impresso 1,35 x 0,75 100,00')
    expect(r.quantidade).toBe(2)
    expect(r.altura).toBeCloseTo(1.35, 4)
    expect(r.largura).toBeCloseTo(0.75, 4)
    expect(r.valorUnitario).toBe(100)
  })

  it('aceita o separador com espacos e x maiusculo', () => {
    const r = interpretarLinha('6 placa ACM 60 X 80 120,50')
    expect(r.altura).toBeCloseTo(0.6, 4)
    expect(r.largura).toBeCloseTo(0.8, 4)
    expect(r.valorUnitario).toBe(120.5)
  })

  it('sugere unidade quando nao ha dimensao', () => {
    const r = interpretarLinha('18 letra caixa PVC 34,00')
    expect(r.quantidade).toBe(18)
    expect(r.descricao).toBe('letra caixa PVC')
    expect(r.altura).toBeUndefined()
    expect(r.unidadeSugerida).toBe('unidade')
    expect(r.valorUnitario).toBe(34)
  })

  it('assume quantidade 1 quando a linha nao comeca com numero', () => {
    const r = interpretarLinha('placa ACM 50x50 62,00')
    expect(r.quantidade).toBe(1)
    expect(r.descricao).toBe('placa ACM')
  })

  it('marca confianca parcial quando nao acha o valor', () => {
    const r = interpretarLinha('3 banner lona 200x100')
    expect(r.quantidade).toBe(3)
    expect(r.valorUnitario).toBeUndefined()
    expect(r.confianca).toBe('parcial')
  })

  it('nao confunde o preco com dimensao', () => {
    const r = interpretarLinha('1 lona 300x150 450,00')
    expect(r.altura).toBeCloseTo(3, 4)
    expect(r.largura).toBeCloseTo(1.5, 4)
    expect(r.valorUnitario).toBe(450)
  })
})
