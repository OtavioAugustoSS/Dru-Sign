import { describe, it, expect } from 'vitest'
import { resumirOperacao, porAno, type OrdemMedida } from './indicadores'

function ordem(p: Partial<OrdemMedida> & { id: string }): OrdemMedida {
  return {
    estadoProducao: 'aberta', abertaEm: '2026-08-01T12:00:00.000Z', concluidaEm: null,
    precoFinal: '100.00', totalRecebido: '0.00', temItem: true, responsavelId: 'u1', ...p,
  }
}

describe('resumirOperacao', () => {
  it('conta abertas, concluidas e canceladas do periodo', () => {
    const r = resumirOperacao([
      ordem({ id: 'a' }),
      ordem({ id: 'b', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z' }),
      ordem({ id: 'c', estadoProducao: 'cancelada' }),
      ordem({ id: 'd', estadoProducao: 'orcamento' }),
    ])
    expect(r).toMatchObject({ total: 4, abertas: 1, concluidas: 1, canceladas: 1, orcamentos: 1 })
  })

  it('nao finalizadas e a fatia de abertas sobre abertas mais concluidas — o alvo da spec e abaixo de 5%', () => {
    const abertas = Array.from({ length: 3 }, (_, i) => ordem({ id: `a${i}` }))
    const concluidas = Array.from({ length: 7 }, (_, i) => ordem({ id: `c${i}`, estadoProducao: 'concluida' as const, concluidaEm: '2026-08-10T12:00:00.000Z' }))
    expect(resumirOperacao([...abertas, ...concluidas]).naoFinalizadasPct).toBe('30.0')
    expect(resumirOperacao([]).naoFinalizadasPct).toBe('0.0')
    // Orcamento e cancelada ficam fora da conta: nunca foram para producao.
    expect(resumirOperacao([ordem({ id: 'x', estadoProducao: 'orcamento' }), ordem({ id: 'y', estadoProducao: 'cancelada' })]).naoFinalizadasPct).toBe('0.0')
  })

  it('valor parado soma o saldo das ordens vivas nao pagas, e nao conta orcamento nem cancelada', () => {
    const r = resumirOperacao([
      ordem({ id: 'a', precoFinal: '2528.00', totalRecebido: '0.00' }),
      ordem({ id: 'b', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z', precoFinal: '300.00', totalRecebido: '100.00' }),
      ordem({ id: 'c', estadoProducao: 'concluida', concluidaEm: '2026-08-10T12:00:00.000Z', precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ id: 'd', estadoProducao: 'cancelada', precoFinal: '900.00' }),
      ordem({ id: 'e', estadoProducao: 'orcamento', precoFinal: '900.00' }),
    ])
    expect(r.valorParado).toBe('2728.00')
  })

  it('prazo de entrega: mediana e p90 em dias, so das concluidas', () => {
    const dias = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
    const ordens = dias.map((d, i) => ordem({
      id: `c${i}`, estadoProducao: 'concluida' as const,
      abertaEm: '2026-01-01T12:00:00.000Z',
      concluidaEm: new Date(Date.UTC(2026, 0, 1 + d, 12)).toISOString(),
    }))
    // Nearest-rank: de 10 prazos, a mediana e o 5o e o p90 e o 9o. O 100 fica de fora dos dois —
    // e exatamente por isso a mediana e o p90 andam juntos na tela, nunca a media.
    const r = resumirOperacao([...ordens, ordem({ id: 'aberta' })])
    expect(r).toMatchObject({ prazoMedianoDias: 5, prazoP90Dias: 9 })
  })

  it('sem concluida, o prazo e null em vez de zero', () => {
    expect(resumirOperacao([ordem({ id: 'a' })])).toMatchObject({ prazoMedianoDias: null, prazoP90Dias: null })
  })

  it('item estruturado e quem tem pelo menos um item; o legado tinha 0%', () => {
    expect(resumirOperacao([ordem({ id: 'a' }), ordem({ id: 'b', temItem: false })]).comItemPct).toBe('50.0')
    expect(resumirOperacao([]).comItemPct).toBe('0.0')
  })

  it('conta quantas pessoas abriram ordem — o alvo da spec e mais de uma', () => {
    expect(resumirOperacao([ordem({ id: 'a' }), ordem({ id: 'b', responsavelId: 'u2' }), ordem({ id: 'c' })]).pessoas).toBe(2)
  })

  it('faturado e recebido do periodo', () => {
    const r = resumirOperacao([
      ordem({ id: 'a', precoFinal: '100.00', totalRecebido: '40.00' }),
      ordem({ id: 'b', precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ id: 'c', estadoProducao: 'cancelada', precoFinal: '900.00', totalRecebido: '0.00' }),
    ])
    expect(r).toMatchObject({ faturado: '150.00', recebido: '90.00' })
  })
})

describe('porAno', () => {
  it('uma linha por ano, do mais recente para o mais antigo, com ticket medio', () => {
    const linhas = porAno([
      ordem({ id: 'a', abertaEm: '2025-03-01T12:00:00.000Z', precoFinal: '100.00', totalRecebido: '100.00', estadoProducao: 'concluida', concluidaEm: '2025-03-05T12:00:00.000Z' }),
      ordem({ id: 'b', abertaEm: '2025-07-01T12:00:00.000Z', precoFinal: '300.00', totalRecebido: '50.00' }),
      ordem({ id: 'c', abertaEm: '2026-01-01T12:00:00.000Z', precoFinal: '250.00', totalRecebido: '250.00', estadoProducao: 'concluida', concluidaEm: '2026-01-02T12:00:00.000Z' }),
      ordem({ id: 'd', abertaEm: '2026-02-01T12:00:00.000Z', estadoProducao: 'cancelada', precoFinal: '900.00' }),
    ])
    // 2026 tem duas linhas, mas a cancelada nao e ordem que faturou: `ordens` conta so as vivas.
    expect(linhas).toEqual([
      { ano: 2026, ordens: 1, concluidas: 1, faturado: '250.00', recebido: '250.00', ticketMedio: '250.00' },
      { ano: 2025, ordens: 2, concluidas: 1, faturado: '400.00', recebido: '150.00', ticketMedio: '200.00' },
    ])
  })

  it('ano sem ordem faturada tem ticket medio zero, nao divisao por zero', () => {
    expect(porAno([ordem({ id: 'a', abertaEm: '2026-01-01T12:00:00.000Z', estadoProducao: 'cancelada' })])).toEqual([
      { ano: 2026, ordens: 0, concluidas: 0, faturado: '0.00', recebido: '0.00', ticketMedio: '0.00' },
    ])
  })

  it('lista vazia da array vazio', () => {
    expect(porAno([])).toEqual([])
  })
})
