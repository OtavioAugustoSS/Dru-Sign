import { describe, it, expect } from 'vitest'
import { agruparPorConta, paraCsv } from './relatorio'
import type { LinhaLivro } from './lancamento'

const linha = (p: Partial<LinhaLivro>): LinhaLivro => ({
  id: 'x', data: '2026-08-10T00:00:00.000Z', tipo: 'entrada', valor: '100.00', contaCodigo: 1,
  contaNome: 'VENDAS DIVERSAS', historico: 'OS 018461', ordemId: null, ordemNumero: null,
  fornecedor: null, parcela: null, totalParcelas: null, usuarioNome: 'Odete Silva',
  estornadoEm: null, motivoEstorno: null, ...p,
})

describe('agruparPorConta', () => {
  it('soma por conta, separa entrada de saida e fecha o saldo', () => {
    const r = agruparPorConta([
      linha({ valor: '300.00' }),
      linha({ valor: '150.00' }),
      linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' }),
      linha({ tipo: 'saida', contaCodigo: 5, contaNome: 'ALUGUEL', valor: '1200.00' }),
    ])
    expect(r.entradas.map((c) => [c.codigo, c.nome, c.total, c.lancamentos])).toEqual([[1, 'VENDAS DIVERSAS', '450.00', 2]])
    expect(r.saidas.map((c) => [c.codigo, c.total])).toEqual([[5, '1200.00'], [3, '45.90']])
    expect(r).toMatchObject({ totalEntradas: '450.00', totalSaidas: '1245.90', saldo: '-795.90' })
  })

  it('estornado nao entra em conta nenhuma — e o que o contador nao pode ver como movimento', () => {
    const r = agruparPorConta([
      linha({ valor: '300.00' }),
      linha({ valor: '999.00', estornadoEm: '2026-08-11T12:00:00.000Z', motivoEstorno: 'digitado errado' }),
    ])
    expect(r.totalEntradas).toBe('300.00')
    expect(r.entradas[0]?.lancamentos).toBe(1)
  })

  it('cada grupo ordena pelo maior valor, que e por onde o contador olha', () => {
    const r = agruparPorConta([
      linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' }),
      linha({ tipo: 'saida', contaCodigo: 4, contaNome: 'TELEFONE', valor: '89.00' }),
      linha({ tipo: 'saida', contaCodigo: 5, contaNome: 'ALUGUEL', valor: '1200.00' }),
    ])
    expect(r.saidas.map((c) => c.nome)).toEqual(['ALUGUEL', 'TELEFONE', 'AGUA'])
  })

  it('periodo sem lancamento nenhum da tudo zerado, nao erro', () => {
    expect(agruparPorConta([])).toEqual({ entradas: [], saidas: [], totalEntradas: '0.00', totalSaidas: '0.00', saldo: '0.00' })
  })
})

describe('paraCsv', () => {
  it('sai com cabecalho, ponto e virgula e virgula decimal — o Excel do escritorio abre direto', () => {
    const r = agruparPorConta([linha({ valor: '1.234,56'.replace('.', '').replace(',', '.') }), linha({ tipo: 'saida', contaCodigo: 3, contaNome: 'AGUA', valor: '45.90' })])
    const csv = paraCsv(r, { de: '2026-08-01', ate: '2026-08-31' })
    const linhas = csv.split('\r\n')
    expect(linhas[0]).toBe('Periodo;01/08/2026;31/08/2026')
    expect(linhas[2]).toBe('Tipo;Codigo;Conta;Lancamentos;Total')
    expect(linhas[3]).toBe('Entrada;1;VENDAS DIVERSAS;1;1234,56')
    expect(linhas[4]).toBe('Saida;3;AGUA;1;45,90')
    expect(linhas).toContain('Total de entradas;;;;1234,56')
    expect(linhas).toContain('Total de saidas;;;;45,90')
    expect(linhas).toContain('Saldo;;;;1188,66')
  })

  it('nome de conta com ponto e virgula sai entre aspas, senao quebra a coluna', () => {
    const r = agruparPorConta([linha({ contaNome: 'DESPESAS; DIVERSAS' })])
    expect(paraCsv(r, { de: '2026-08-01', ate: '2026-08-31' })).toContain('"DESPESAS; DIVERSAS"')
  })
})
