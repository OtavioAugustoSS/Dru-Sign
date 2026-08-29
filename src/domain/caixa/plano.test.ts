import { describe, it, expect } from 'vitest'
import { converterContaLegado } from './plano'

describe('converterContaLegado', () => {
  it('le CONTA, NOME, NIVEL, TIPO e NOMENIVEL como estao', () => {
    expect(converterContaLegado({ CONTA: 1, NOME: 'VENDAS DIVERSAS', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'RECEITA GERAL', OBS: '' }))
      .toEqual({ codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' })
    expect(converterContaLegado({ CONTA: 24, NOME: 'ODETE   - PESSOAL', NIVEL: 0, TIPO: 'D', NOMENIVEL: 'COMPRAS', OBS: '' }))
      .toEqual({ codigo: 24, nome: 'ODETE   - PESSOAL', nivel: 0, tipo: 'despesa', grupo: 'COMPRAS' })
  })
  it('recusa codigo ausente, tipo desconhecido e nome vazio', () => {
    expect(() => converterContaLegado({ CONTA: null, NOME: 'X', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'G' })).toThrow(/codigo/)
    expect(() => converterContaLegado({ CONTA: 1, NOME: 'X', NIVEL: 1, TIPO: 'Z', NOMENIVEL: 'G' })).toThrow(/tipo/)
    expect(() => converterContaLegado({ CONTA: 1, NOME: '  ', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'G' })).toThrow(/nome/)
  })
  it('grupo vazio vira "SEM GRUPO" e nivel ausente vira 0', () => {
    expect(converterContaLegado({ CONTA: 9, NOME: 'DARF', NIVEL: null, TIPO: 'D', NOMENIVEL: '' })).toMatchObject({ nivel: 0, grupo: 'SEM GRUPO' })
  })
})
