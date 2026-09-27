import { describe, it, expect } from 'vitest'
import { dinheiro } from './dinheiro'
import { ErroDeValidacao } from './erros'
import { arredondarPasso, calcularVenda, precoEfetivo, PASSOS } from './familia'
import { calcularArea, calcularMetroLinear } from './formulas'

describe('arredondarPasso', () => {
  it('com passo de um centavo faz o mesmo que arredondarCentavos', () => {
    expect(arredondarPasso(dinheiro('83.604'), dinheiro('0.01')).toFixed(2)).toBe('83.60')
    expect(arredondarPasso(dinheiro('83.605'), dinheiro('0.01')).toFixed(2)).toBe('83.61')
  })

  it('arredonda para o meio real mais proximo', () => {
    expect(arredondarPasso(dinheiro('83.60'), dinheiro('0.50')).toFixed(2)).toBe('83.50')
    expect(arredondarPasso(dinheiro('83.80'), dinheiro('0.50')).toFixed(2)).toBe('84.00')
  })

  it('arredonda para o real mais proximo', () => {
    expect(arredondarPasso(dinheiro('83.60'), dinheiro('1')).toFixed(2)).toBe('84.00')
    expect(arredondarPasso(dinheiro('83.40'), dinheiro('1')).toFixed(2)).toBe('83.00')
  })

  it('recusa passo zero ou negativo, que nao arredonda nada', () => {
    expect(() => arredondarPasso(dinheiro('10'), dinheiro('0'))).toThrow(ErroDeValidacao)
    expect(() => arredondarPasso(dinheiro('10'), dinheiro('-1'))).toThrow(ErroDeValidacao)
  })

  it('oferece os tres passos que a tela deixa escolher', () => {
    expect(PASSOS.map((p) => p.valor)).toEqual(['0.01', '0.50', '1.00'])
  })
})

describe('calcularVenda', () => {
  it('soma a margem sobre o custo', () => {
    // O caso do catalogo: lona a 38,00 com 120% de margem sai a 83,60.
    const v = calcularVenda({ custo: '38.00', margem: '120', arredondamento: '0.01' })
    expect(v.toFixed(2)).toBe('83.60')
  })

  it('com margem zero a venda e o proprio custo', () => {
    expect(calcularVenda({ custo: '38.00', margem: '0', arredondamento: '0.01' }).toFixed(2)).toBe('38.00')
  })

  it('aceita margem negativa, que e decisao comercial e nao erro', () => {
    expect(calcularVenda({ custo: '100', margem: '-10', arredondamento: '0.01' }).toFixed(2)).toBe('90.00')
  })

  it('aplica o arredondamento da familia', () => {
    expect(calcularVenda({ custo: '38.00', margem: '120', arredondamento: '0.50' }).toFixed(2)).toBe('83.50')
    expect(calcularVenda({ custo: '38.00', margem: '120', arredondamento: '1.00' }).toFixed(2)).toBe('84.00')
  })

  it('recusa custo negativo', () => {
    expect(() => calcularVenda({ custo: '-1', margem: '120', arredondamento: '0.01' })).toThrow(ErroDeValidacao)
  })

  it('custo zero e legitimo e da venda zero', () => {
    expect(calcularVenda({ custo: '0', margem: '120', arredondamento: '0.01' }).toFixed(2)).toBe('0.00')
  })
})

describe('precoEfetivo', () => {
  const familia = { margem: '120', arredondamento: '0.01' }

  it('calcula pela familia quando ha custo e o preco nao esta travado', () => {
    const r = precoEfetivo({ preco: '10.00', custo: '38.00', precoTravado: false }, familia)
    expect(r.valor.toFixed(2)).toBe('83.60')
    expect(r.origem).toBe('familia')
  })

  it('respeita o preco travado e ignora a familia', () => {
    const r = precoEfetivo({ preco: '265.00', custo: '38.00', precoTravado: true }, familia)
    expect(r.valor.toFixed(2)).toBe('265.00')
    expect(r.origem).toBe('travado')
  })

  it('sem custo informado mantem o preco digitado', () => {
    const r = precoEfetivo({ preco: '44.00', custo: null, precoTravado: false }, familia)
    expect(r.valor.toFixed(2)).toBe('44.00')
    expect(r.origem).toBe('sem custo')
  })

  it('sem familia mantem o preco digitado, que e como o sistema funcionava antes', () => {
    const r = precoEfetivo({ preco: '44.00', custo: '20.00', precoTravado: false }, null)
    expect(r.valor.toFixed(2)).toBe('44.00')
    expect(r.origem).toBe('sem família')
  })
})

describe('minimo de cobranca no item da ordem', () => {
  it('cobra a medida cheia quando a peca passa do minimo', () => {
    const r = calcularArea({ unidade: 'm2', quantidade: 1, valorUnitario: '100', altura: '2', largura: '1', minimoMedida: '1' })
    expect(r.medida.toFixed(2)).toBe('2.00')
    expect(r.total.toFixed(2)).toBe('200.00')
  })

  it('cobra o minimo quando a peca e menor que ele', () => {
    // 0,4 m2 numa familia com minimo de 1 m2 sai cobrada como 1 m2.
    const r = calcularArea({ unidade: 'm2', quantidade: 1, valorUnitario: '100', altura: '0.5', largura: '0.8', minimoMedida: '1' })
    expect(r.medida.toFixed(2)).toBe('1.00')
    expect(r.total.toFixed(2)).toBe('100.00')
  })

  it('sem minimo se comporta exatamente como antes', () => {
    const r = calcularArea({ unidade: 'm2', quantidade: 1, valorUnitario: '100', altura: '0.5', largura: '0.8' })
    expect(r.medida.toFixed(2)).toBe('0.40')
    expect(r.total.toFixed(2)).toBe('40.00')
  })

  it('vale tambem para metro linear, que e como se cobra acabamento', () => {
    const r = calcularMetroLinear({ unidade: 'metro_linear', quantidade: 1, valorUnitario: '10', altura: '0.2', largura: '0.3', minimoMedida: '5' })
    expect(r.medida.toFixed(2)).toBe('5.00')
    expect(r.total.toFixed(2)).toBe('50.00')
  })
})
