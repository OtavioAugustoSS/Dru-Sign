import { describe, it, expect } from 'vitest'
import { resumirPagamento, validarRecebimento, ROTULO_PAGAMENTO } from './pagamento'
import { FORMAS_PAGAMENTO, ehFormaPagamento, ROTULO_FORMA } from './formas'

describe('formas de pagamento', () => {
  it('sao sete, sem Avista, e cada uma tem rotulo', () => {
    expect(FORMAS_PAGAMENTO).toEqual(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'boleto'])
    for (const f of FORMAS_PAGAMENTO) expect(ROTULO_FORMA[f]).toBeTruthy()
    expect(ehFormaPagamento('pix')).toBe(true)
    expect(ehFormaPagamento('avista')).toBe(false)
    expect(ehFormaPagamento('')).toBe(false)
  })
})

describe('resumirPagamento', () => {
  it('deriva total, saldo e estado da soma dos recebimentos (strings exatas)', () => {
    const r = resumirPagamento('2528.00', ['1000.00', '528.00'])
    expect(r.totalRecebido.toFixed(2)).toBe('1528.00')
    expect(r.saldo.toFixed(2)).toBe('1000.00')
    expect(r.estado).toBe('parcial')
  })
  it.each([
    ['150.00', [], 'nao_pago', '150.00'],
    ['150.00', ['150.00'], 'pago', '0.00'],
    ['150.00', ['149.99'], 'pago', '0.01'],
    ['150.00', ['149.98'], 'parcial', '0.02'],
    ['0.00', [], 'pago', '0.00'],
  ] as const)('preco %s recebido %j -> %s (saldo %s)', (preco: string, recebidos: readonly string[], estado: string, saldo: string) => {
    const r = resumirPagamento(preco, [...recebidos])
    expect(r.estado).toBe(estado)
    expect(r.saldo.toFixed(2)).toBe(saldo)
  })
  it('saldo nunca fica negativo', () => {
    expect(resumirPagamento('100.00', ['100.00', '5.00']).saldo.toFixed(2)).toBe('0.00')
  })
  it('tem rotulo para os tres estados', () => {
    expect(ROTULO_PAGAMENTO).toEqual({ nao_pago: 'Não pago', parcial: 'Parcial', pago: 'Pago' })
  })
})

describe('validarRecebimento', () => {
  const situacao = { precoFinal: '150.00', totalRecebido: '0.00', estadoProducao: 'aberta' as const }
  it('aceita valor como a Odete digita, forma valida e data do calendario', () => {
    const r = validarRecebimento({ valor: '150,00', forma: 'pix', data: '2026-08-29' }, situacao)
    expect(r.valor.toFixed(2)).toBe('150.00')
    expect(r.forma).toBe('pix')
    expect(r.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
  })
  it('aceita parcial e recusa acima do saldo (tolerancia de um centavo)', () => {
    expect(validarRecebimento({ valor: '80', forma: 'dinheiro', data: '2026-08-29' }, situacao).valor.toFixed(2)).toBe('80.00')
    expect(validarRecebimento({ valor: '150,01', forma: 'dinheiro', data: '2026-08-29' }, situacao).valor.toFixed(2)).toBe('150.01')
    expect(() => validarRecebimento({ valor: '150,02', forma: 'dinheiro', data: '2026-08-29' }, situacao)).toThrow(/maior que o saldo a receber \(R\$ 150,00\)/)
    expect(() => validarRecebimento({ valor: '100', forma: 'pix', data: '2026-08-29' }, { ...situacao, totalRecebido: '80.00' })).toThrow(/R\$ 70,00/)
  })
  it.each([
    [{ valor: '', forma: 'pix', data: '2026-08-29' }, /valor/i],
    [{ valor: '0', forma: 'pix', data: '2026-08-29' }, /maior que zero/],
    [{ valor: 'abc', forma: 'pix', data: '2026-08-29' }, /valor/i],
    [{ valor: '10', forma: '', data: '2026-08-29' }, /escolha a forma de pagamento/i],
    [{ valor: '10', forma: 'avista', data: '2026-08-29' }, /escolha a forma de pagamento/i],
    [{ valor: '10', forma: 'pix', data: '29/08/2026' }, /data/i],
    [{ valor: '10', forma: 'pix', data: '' }, /data/i],
  ])('recusa %j', (dados: { valor: string; forma: string; data: string }, erro: RegExp) => {
    expect(() => validarRecebimento(dados, situacao)).toThrow(erro)
  })
  it('recusa por estado: orcamento, cancelada e ordem sem valor', () => {
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, estadoProducao: 'orcamento' })).toThrow(/aprove o orçamento/i)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, estadoProducao: 'cancelada' })).toThrow(/cancelada/i)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, precoFinal: '0.00' })).toThrow(/não tem valor a receber/i)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, totalRecebido: '150.00' })).toThrow(/já está paga/i)
  })
})
