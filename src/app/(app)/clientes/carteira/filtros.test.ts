import { describe, expect, it } from 'vitest'
import { aplicar, cidadeDo, estaFiltrando, fatiaDoRecorte, lerFiltros, parametrosDe } from './filtros'
import type { GrupoCarteira } from '@/domain/clientes/carteira'

function grupo(p: Partial<GrupoCarteira> & { nome: string }): GrupoCarteira {
  return {
    documento: null,
    apelido: null,
    cadastros: 1,
    clienteIds: [p.nome],
    ordens: 1,
    faturado: '100.00',
    fatiaPct: '0.0',
    ultimaOrdemEm: '2026-01-01T00:00:00.000Z',
    recencia: 'ativo',
    ...p,
  }
}

const VAZIO = { cidades: new Map<string, string>(), arquivados: new Set<string>() }
const PADRAO = lerFiltros({})

describe('filtros da carteira', () => {
  it('sem filtro, ordena do maior faturamento para o menor', () => {
    const r = aplicar(
      [grupo({ nome: 'pequeno', faturado: '10.00' }), grupo({ nome: 'grande', faturado: '900.00' })],
      PADRAO,
      VAZIO,
    )
    expect(r.map((g) => g.nome)).toEqual(['grande', 'pequeno'])
  })

  it('recorta por situacao, valor minimo e periodo da ultima compra', () => {
    const grupos = [
      grupo({ nome: 'ativo caro', recencia: 'ativo', faturado: '30000.00', ultimaOrdemEm: '2026-08-01T00:00:00.000Z' }),
      grupo({ nome: 'adormecido caro', recencia: 'adormecido', faturado: '25000.00', ultimaOrdemEm: '2025-06-10T00:00:00.000Z' }),
      grupo({ nome: 'adormecido barato', recencia: 'adormecido', faturado: '80.00', ultimaOrdemEm: '2025-06-10T00:00:00.000Z' }),
    ]
    expect(aplicar(grupos, { ...PADRAO, situacao: 'adormecido' }, VAZIO).map((g) => g.nome))
      .toEqual(['adormecido caro', 'adormecido barato'])
    expect(aplicar(grupos, { ...PADRAO, minimo: '20000' }, VAZIO).map((g) => g.nome))
      .toEqual(['ativo caro', 'adormecido caro'])
    expect(aplicar(grupos, { ...PADRAO, de: '2025-01-01', ate: '2025-12-31' }, VAZIO).map((g) => g.nome))
      .toEqual(['adormecido caro', 'adormecido barato'])
  })

  it('a busca ignora acento e caixa, e olha nome, apelido e documento', () => {
    const grupos = [
      grupo({ nome: 'ASSOCIAÇÃO DE ENSINO', apelido: 'FACTU' }),
      grupo({ nome: 'BRITACAL', documento: '26970103000500' }),
    ]
    expect(aplicar(grupos, { ...PADRAO, q: 'associacao' }, VAZIO).map((g) => g.nome)).toEqual(['ASSOCIAÇÃO DE ENSINO'])
    expect(aplicar(grupos, { ...PADRAO, q: 'factu' }, VAZIO).map((g) => g.nome)).toEqual(['ASSOCIAÇÃO DE ENSINO'])
    expect(aplicar(grupos, { ...PADRAO, q: '269701' }, VAZIO).map((g) => g.nome)).toEqual(['BRITACAL'])
  })

  it('a cidade do grupo e a do primeiro cadastro que tiver uma', () => {
    const g = grupo({ nome: 'fazenda', clienteIds: ['a', 'b'] })
    const cidades = new Map([['b', 'ARINOS']])
    expect(cidadeDo(g, cidades)).toBe('ARINOS')
    expect(aplicar([g], { ...PADRAO, cidade: 'ARINOS' }, { ...VAZIO, cidades })).toHaveLength(1)
    expect(aplicar([g], { ...PADRAO, cidade: 'UNAI' }, { ...VAZIO, cidades })).toHaveLength(0)
  })

  it('arquivado entra por padrao, e so sai quando o grupo INTEIRO esta arquivado', () => {
    const so = grupo({ nome: 'so arquivado', clienteIds: ['a'] })
    const misto = grupo({ nome: 'misto', clienteIds: ['a', 'b'] })
    const ctx = { ...VAZIO, arquivados: new Set(['a']) }
    expect(aplicar([so, misto], PADRAO, ctx)).toHaveLength(2)
    const escondendo = { ...PADRAO, incluirArquivados: false }
    expect(aplicar([so, misto], escondendo, ctx).map((g) => g.nome)).toEqual(['misto'])
  })

  it('a fatia e a do recorte sobre o total da carteira', () => {
    const r = fatiaDoRecorte([grupo({ nome: 'a', faturado: '250.00' })], '1000.00')
    expect(r).toEqual({ soma: '250.00', pct: '25.0' })
    expect(fatiaDoRecorte([], '0.00')).toEqual({ soma: '0.00', pct: '0.0' })
  })

  it('parametro invalido no endereco cai no padrao, e o padrao nao vira parametro', () => {
    const f = lerFiltros({ situacao: 'inventado', minimo: '77', ordem: 'sei-la' })
    expect(f).toMatchObject({ situacao: 'todas', minimo: '', ordem: 'faturado' })
    expect(estaFiltrando(f)).toBe(false)
    expect(parametrosDe(f)).toEqual({
      q: undefined, situacao: undefined, minimo: undefined, cidade: undefined,
      de: undefined, ate: undefined, arquivados: undefined, ordem: undefined,
    })
  })
})
