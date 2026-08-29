import { describe, it, expect } from 'vitest'
import { classificarUrgencia, ROTULO_URGENCIA, type OrdemDaProducao } from './urgencia'

const agora = new Date('2026-08-29T15:00:00.000Z') // 12:00 em Sao Paulo
const dia = (s: string) => `${s}T00:00:00.000Z`

function ordem(p: Partial<OrdemDaProducao> & { numero: number }): OrdemDaProducao {
  return {
    id: `id-${p.numero}`, clienteNome: null, clienteApelido: null,
    abertaEm: '2026-08-20T12:00:00.000Z', prometidaPara: null, versao: 1, itens: ['PLACA ACM'], ...p,
  }
}

describe('classificarUrgencia', () => {
  it('separa atrasada, hoje, esta semana e sem data, nessa ordem', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-09-10') }),
      ordem({ numero: 2, prometidaPara: dia('2026-08-28') }),
      ordem({ numero: 3, prometidaPara: dia('2026-08-29') }),
      ordem({ numero: 4, prometidaPara: null, abertaEm: '2026-08-10T12:00:00.000Z' }), // aberta antes da 1
      ordem({ numero: 5, prometidaPara: dia('2026-09-02') }),
    ], agora)
    expect(f.grupos.map((g) => [g.grupo, g.ordens.map((o) => o.numero)])).toEqual([
      ['atrasada', [2]],
      ['hoje', [3]],
      ['semana', [5]],
      ['sem_data', [4, 1]],
    ])
  })

  it('dentro de atrasada, a mais atrasada primeiro; dentro de semana, a mais proxima primeiro', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-08-27') }),
      ordem({ numero: 2, prometidaPara: dia('2026-07-01') }),
      ordem({ numero: 3, prometidaPara: dia('2026-09-04') }),
      ordem({ numero: 4, prometidaPara: dia('2026-08-31') }),
    ], agora)
    expect(f.grupos[0]).toMatchObject({ grupo: 'atrasada' })
    expect(f.grupos[0]?.ordens.map((o) => o.numero)).toEqual([2, 1])
    expect(f.grupos.find((g) => g.grupo === 'semana')?.ordens.map((o) => o.numero)).toEqual([4, 3])
  })

  it('sem data combinada vem por ultimo, a aberta ha mais tempo primeiro; prometida longe cai aqui', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, abertaEm: '2026-08-25T12:00:00.000Z' }),
      ordem({ numero: 2, abertaEm: '2026-06-01T12:00:00.000Z' }),
      ordem({ numero: 3, prometidaPara: dia('2026-12-25'), abertaEm: '2026-08-01T12:00:00.000Z' }),
    ], agora)
    const semData = f.grupos.find((g) => g.grupo === 'sem_data')
    expect(semData?.ordens.map((o) => o.numero)).toEqual([2, 3, 1])
  })

  it('grupo vazio nao aparece, e a fila vazia nao tem grupo nenhum', () => {
    expect(classificarUrgencia([ordem({ numero: 1, prometidaPara: dia('2026-08-28') })], agora).grupos.map((g) => g.grupo)).toEqual(['atrasada'])
    expect(classificarUrgencia([], agora)).toEqual({ grupos: [], total: 0, atrasadas: 0 })
  })

  it('conta o total e quantas estao atrasadas', () => {
    const f = classificarUrgencia([
      ordem({ numero: 1, prometidaPara: dia('2026-08-01') }),
      ordem({ numero: 2, prometidaPara: dia('2026-08-28') }),
      ordem({ numero: 3, prometidaPara: dia('2026-08-29') }),
    ], agora)
    expect(f).toMatchObject({ total: 3, atrasadas: 2 })
  })

  it('cada grupo tem rotulo no vocabulario da loja', () => {
    expect(ROTULO_URGENCIA).toEqual({ atrasada: 'Atrasadas', hoje: 'Para hoje', semana: 'Esta semana', sem_data: 'Sem data combinada' })
  })

  it('a virada do dia segue Sao Paulo, nao UTC', () => {
    // 02:30 UTC do dia 30 ainda e 23:30 do dia 29 em Sao Paulo: prometida para 29 nao esta atrasada.
    const f = classificarUrgencia([ordem({ numero: 1, prometidaPara: dia('2026-08-29') })], new Date('2026-08-30T02:30:00.000Z'))
    expect(f.grupos[0]?.grupo).toBe('hoje')
  })
})
