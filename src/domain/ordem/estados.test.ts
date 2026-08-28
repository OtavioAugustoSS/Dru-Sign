import { describe, it, expect } from 'vitest'
import { podeTransicionar, transicionar, calcularEstadoPagamento } from './estados'

describe('transicoes de producao', () => {
  it.each([
    ['orcamento', 'aberta', true],
    ['orcamento', 'cancelada', true],
    ['aberta', 'concluida', true],
    ['aberta', 'cancelada', true],
    ['concluida', 'cancelada', true],
  ] as const)('%s -> %s permitida', (de, para, esperado) => {
    expect(podeTransicionar(de, para)).toBe(esperado)
  })

  it.each([
    ['orcamento', 'concluida'],
    ['concluida', 'aberta'],
    ['cancelada', 'aberta'],
    ['cancelada', 'concluida'],
    ['aberta', 'orcamento'],
  ] as const)('%s -> %s proibida', (de, para) => {
    expect(podeTransicionar(de, para)).toBe(false)
  })

  it('transicionar devolve o novo estado', () => {
    expect(transicionar('aberta', 'concluida')).toBe('concluida')
  })

  it('transicionar lanca em transicao invalida', () => {
    expect(() => transicionar('concluida', 'aberta')).toThrow(
      'transicao invalida: concluida -> aberta',
    )
  })

  it('nao permite transicao para o mesmo estado', () => {
    expect(podeTransicionar('aberta', 'aberta')).toBe(false)
  })
})

describe('estado de pagamento derivado', () => {
  it('sem recebimento e nao pago', () => {
    expect(calcularEstadoPagamento(1000, [])).toBe('nao_pago')
  })

  it('recebimento parcial', () => {
    expect(calcularEstadoPagamento(1000, [400])).toBe('parcial')
  })

  it('soma de varios recebimentos quita', () => {
    expect(calcularEstadoPagamento(1000, [400, 300, 300])).toBe('pago')
  })

  it('recebimento acima do total conta como pago', () => {
    expect(calcularEstadoPagamento(1000, [1200])).toBe('pago')
  })

  it('tolera diferenca de um centavo por arredondamento', () => {
    expect(calcularEstadoPagamento(100, [33.33, 33.33, 33.33])).toBe('pago')
  })

  it('ordem de valor zero ja nasce paga', () => {
    expect(calcularEstadoPagamento(0, [])).toBe('pago')
  })
})
