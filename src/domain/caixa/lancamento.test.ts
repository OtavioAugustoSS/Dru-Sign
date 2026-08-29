import { describe, it, expect } from 'vitest'
import { validarSaida, historicoDeRecebimento, formatarNumeroOs, ROTULO_TIPO_CONTA } from './lancamento'

const despesa = { tipo: 'despesa' as const, ativa: true }

describe('validarSaida', () => {
  it('aceita valor, data, historico e parcela como a Odete digita', () => {
    const s = validarSaida({ valor: '1.358,81', data: '2026-08-29', historico: '  Chapa ACM, Solvente ', parcela: '2', totalParcelas: '3' }, despesa)
    expect(s.valor.toFixed(2)).toBe('1358.81')
    expect(s.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
    expect(s.historico).toBe('Chapa ACM, Solvente')
    expect(s).toMatchObject({ parcela: 2, totalParcelas: 3 })
  })
  it('parcela vazia e null; parcela sem total assume 1/1; total sem parcela e recusado', () => {
    expect(validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, despesa)).toMatchObject({ parcela: null, totalParcelas: null })
    expect(validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '1', totalParcelas: '' }, despesa)).toMatchObject({ parcela: 1, totalParcelas: 1 })
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '4', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '0', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
  })
  it.each([
    [{ valor: '', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, /valor/],
    [{ valor: '0', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, /maior que zero/],
    [{ valor: '10', data: '', historico: 'Agua', parcela: '', totalParcelas: '' }, /data/],
    [{ valor: '10', data: '2026-08-29', historico: '   ', parcela: '', totalParcelas: '' }, /histórico/],
  ])('recusa %j', (dados: { valor: string; data: string; historico: string; parcela: string; totalParcelas: string }, erro: RegExp) => {
    expect(() => validarSaida(dados, despesa)).toThrow(erro)
  })
  it('recusa conta de receita e conta desativada', () => {
    const dados = { valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }
    expect(() => validarSaida(dados, { tipo: 'receita', ativa: true })).toThrow(/conta de despesa/)
    expect(() => validarSaida(dados, { tipo: 'despesa', ativa: false })).toThrow(/desativada/)
  })
})

describe('historicoDeRecebimento', () => {
  it('OS com apelido, sem apelido e venda de balcao', () => {
    expect(historicoDeRecebimento(18461, 'Associação de Ensino e Pesquisa de Unaí', 'FACTU', 'pix')).toBe('OS 018461 · FACTU · Pix')
    expect(historicoDeRecebimento(18461, 'Helio da Silva Mota', null, 'dinheiro')).toBe('OS 018461 · Helio da Silva Mota · Dinheiro')
    expect(historicoDeRecebimento(18461, null, null, 'cartao_credito')).toBe('OS 018461 · Venda de balcão · Cartão de crédito')
  })
  it('formatarNumeroOs preenche seis digitos', () => {
    expect(formatarNumeroOs(18461)).toBe('018461')
    expect(formatarNumeroOs(1)).toBe('000001')
  })
  it('rotulos de tipo de conta', () => {
    expect(ROTULO_TIPO_CONTA).toEqual({ receita: 'Receita', despesa: 'Despesa' })
  })
})
