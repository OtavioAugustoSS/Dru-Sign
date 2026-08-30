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

/*
 * A medida sai antes do valor: as duas expressoes disputam o mesmo numero
 * quando a linha termina em medida, e quem saisse primeiro levava. Com o valor
 * saindo antes, "1,00 x 0,50" virava preco de cinquenta centavos e a medida
 * sumia -- e, sem medida, o preco do catalogo nem chegava a ser consultado.
 */
describe('medida no fim da linha', () => {
  it('a linha que termina em medida nao vira preco de cinquenta centavos', () => {
    const l = interpretarLinha('2 acm 3mm branco 1,00 x 0,50')
    expect(l).toMatchObject({ quantidade: 2, descricao: 'acm 3mm branco', altura: 1, largura: 0.5 })
    expect(l.valorUnitario).toBeUndefined()
  })

  it('a notacao da loja, com medida no meio e valor no fim, segue igual', () => {
    const l = interpretarLinha('01 placa acm 35 x 25 e adesivo impresso 30,00')
    expect(l).toMatchObject({ quantidade: 1, altura: 0.35, largura: 0.25, valorUnitario: 30 })
  })

  it('sem medida, o valor no fim continua sendo valor', () => {
    expect(interpretarLinha('4 adesivo recorte 35,00')).toMatchObject({ quantidade: 4, valorUnitario: 35 })
  })
})
