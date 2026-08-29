import { describe, it, expect } from 'vitest'
import { agruparPorDocumento, ROTULO_RECENCIA, type LinhaCarteira } from './carteira'

const agora = new Date('2026-08-29T15:00:00.000Z')
const mesesAtras = (n: number) => new Date(agora.getTime() - n * 30 * 86_400_000).toISOString()

function linha(p: Partial<LinhaCarteira> & { id: string; nome: string }): LinhaCarteira {
  return {
    apelido: null, documento: null,
    ordens: 1, faturado: '100.00', ultimaOrdemEm: mesesAtras(1), ...p,
  }
}

describe('agruparPorDocumento', () => {
  it('cadastros com o mesmo CNPJ viram um grupo so, somando ordens e faturamento', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'PREFEITURA DE UNAI - SAUDE', apelido: 'PMU SAUDE', documento: '18008342000122', ordens: 400, faturado: '200000.00', ultimaOrdemEm: mesesAtras(1) }),
      linha({ id: '2', nome: 'PREFEITURA DE UNAI - CULTURA', apelido: 'PMU CULTURA', documento: '18008342000122', ordens: 338, faturado: '104083.00', ultimaOrdemEm: mesesAtras(3) }),
      linha({ id: '3', nome: 'HELIO DA SILVA MOTA', documento: null, ordens: 2, faturado: '500.00' }),
    ], agora)
    expect(c.grupos[0]).toMatchObject({
      documento: '18008342000122', nome: 'PREFEITURA DE UNAI - SAUDE', cadastros: 2,
      ordens: 738, faturado: '304083.00', recencia: 'ativo',
    })
    expect(c.grupos[0]?.fatiaPct).toBe('99.8')
    expect(c.grupos[1]).toMatchObject({ documento: null, nome: 'HELIO DA SILVA MOTA', cadastros: 1, ordens: 2 })
  })

  it('cliente sem documento e seu proprio grupo, nunca agrupado com outro sem documento', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'A' }),
      linha({ id: '2', nome: 'B' }),
    ], agora)
    expect(c.grupos).toHaveLength(2)
  })

  it('ordena pelo faturado, do maior para o menor', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'PEQUENO', faturado: '10.00' }),
      linha({ id: '2', nome: 'GRANDE', faturado: '9000.00' }),
      linha({ id: '3', nome: 'MEDIO', faturado: '500.00' }),
    ], agora)
    expect(c.grupos.map((g) => g.nome)).toEqual(['GRANDE', 'MEDIO', 'PEQUENO'])
  })

  it.each([
    [1, 'ativo'],
    [6, 'ativo'],
    [7, 'adormecido'],
    [23, 'adormecido'],
    [25, 'perdido'],
  ] as const)('ultima ordem ha %s meses -> %s', (meses: number, esperado: string) => {
    const c = agruparPorDocumento([linha({ id: '1', nome: 'X', ultimaOrdemEm: mesesAtras(meses) })], agora)
    expect(c.grupos[0]?.recencia).toBe(esperado)
  })

  it('cliente que nunca comprou nao entra na carteira', () => {
    const c = agruparPorDocumento([linha({ id: '1', nome: 'NUNCA', ordens: 0, faturado: '0.00', ultimaOrdemEm: null })], agora)
    expect(c.grupos).toHaveLength(0)
    expect(c).toMatchObject({ faturadoTotal: '0.00', paraReativar: [] })
  })

  it('a lista de reativacao e so a faixa adormecida, do maior faturamento para o menor', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'ATIVO', faturado: '9000.00', ultimaOrdemEm: mesesAtras(2) }),
      linha({ id: '2', nome: 'ADORMECIDO PEQUENO', faturado: '300.00', ultimaOrdemEm: mesesAtras(10) }),
      linha({ id: '3', nome: 'ADORMECIDO GRANDE', faturado: '5000.00', ultimaOrdemEm: mesesAtras(18) }),
      linha({ id: '4', nome: 'PERDIDO', faturado: '8000.00', ultimaOrdemEm: mesesAtras(40) }),
    ], agora)
    expect(c.paraReativar.map((g) => g.nome)).toEqual(['ADORMECIDO GRANDE', 'ADORMECIDO PEQUENO'])
    expect(c.contagem).toEqual({ ativo: 1, adormecido: 2, perdido: 1 })
  })

  it('faturado total e a soma dos grupos, e a fatia de cada um fecha em 100', () => {
    const c = agruparPorDocumento([
      linha({ id: '1', nome: 'A', faturado: '750.00' }),
      linha({ id: '2', nome: 'B', faturado: '250.00' }),
    ], agora)
    expect(c.faturadoTotal).toBe('1000.00')
    expect(c.grupos.map((g) => g.fatiaPct)).toEqual(['75.0', '25.0'])
  })

  it('rotulos de recencia', () => {
    expect(ROTULO_RECENCIA).toEqual({ ativo: 'Ativo', adormecido: 'Adormecido', perdido: 'Perdido' })
  })
})
