import { describe, it, expect } from 'vitest'
import { podeTransicionar, transicionar, calcularEstadoPagamento, permissoes, ajusteDesatualizado, ROTULO_ESTADO } from './estados'

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

  it('aceita strings decimais exatas', () => {
    expect(calcularEstadoPagamento('2528.00', ['2528.00'])).toBe('pago')
    expect(calcularEstadoPagamento('2528.00', ['1000.00', '1527.99'])).toBe('pago')
    expect(calcularEstadoPagamento('2528.00', ['1000.00', '1527.98'])).toBe('parcial')
  })
})

describe('permissoes por estado', () => {
  it('orcamento e aberta editam; concluida so observacoes; cancelada nada', () => {
    expect(permissoes('orcamento')).toMatchObject({ editarItens: true, aprovarOrcamento: true, cancelar: true })
    expect(permissoes('aberta')).toMatchObject({ editarItens: true, aprovarOrcamento: false, cancelar: true })
    expect(permissoes('concluida')).toMatchObject({ editarItens: false, editarObservacoes: true, cancelar: false })
    expect(permissoes('cancelada')).toMatchObject({ editarItens: false, editarObservacoes: false })
  })
  it('concluir so em aberta; receber em aberta e concluida', () => {
    expect(permissoes('aberta')).toMatchObject({ concluir: true, receber: true })
    expect(permissoes('concluida')).toMatchObject({ concluir: false, receber: true })
    expect(permissoes('orcamento')).toMatchObject({ concluir: false, receber: false })
    expect(permissoes('cancelada')).toMatchObject({ concluir: false, receber: false })
  })
  it('rotulos no vocabulario da loja', () => {
    expect(ROTULO_ESTADO.concluida).toBe('Serviço finalizado')
  })
})

describe('ajusteDesatualizado', () => {
  it('so avisa quando ha ajuste e o calculado mudou desde ele', () => {
    expect(ajusteDesatualizado({ temAjuste: false, precoCalculado: '10.00', precoCalculadoNoAjuste: null })).toBe(false)
    expect(ajusteDesatualizado({ temAjuste: true, precoCalculado: '10.00', precoCalculadoNoAjuste: '10.00' })).toBe(false)
    expect(ajusteDesatualizado({ temAjuste: true, precoCalculado: '12.00', precoCalculadoNoAjuste: '10.00' })).toBe(true)
  })
})
