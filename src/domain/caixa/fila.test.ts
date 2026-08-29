import { describe, it, expect } from 'vitest'
import { classificarFila, type OrdemDaFila } from './fila'

const agora = new Date('2026-08-29T15:00:00.000Z')
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString()

function ordem(p: Partial<OrdemDaFila> & { numero: number }): OrdemDaFila {
  return {
    id: `id-${p.numero}`, clienteNome: null, clienteApelido: null, estadoProducao: 'aberta',
    abertaEm: dias(0), concluidaEm: null, prometidaPara: null, precoFinal: '100.00', totalRecebido: '0.00', ...p,
  }
}

describe('classificarFila', () => {
  it('paradas: abertas ha mais de 7 dias, a mais antiga primeiro; orcamento e recente ficam fora', () => {
    const fila = classificarFila([
      ordem({ numero: 1, abertaEm: dias(8) }),
      ordem({ numero: 2, abertaEm: dias(30) }),
      ordem({ numero: 3, abertaEm: dias(6) }),
      ordem({ numero: 4, abertaEm: dias(40), estadoProducao: 'orcamento' }),
      ordem({ numero: 5, abertaEm: dias(7) }),
    ], agora)
    expect(fila.paradas.map((o) => o.numero)).toEqual([2, 1])
  })
  it('a cobrar: concluidas nao pagas com o saldo, a concluida ha mais tempo primeiro, e o total somado', () => {
    const fila = classificarFila([
      ordem({ numero: 10, estadoProducao: 'concluida', concluidaEm: dias(2), precoFinal: '300.00', totalRecebido: '100.00' }),
      ordem({ numero: 11, estadoProducao: 'concluida', concluidaEm: dias(5), precoFinal: '2528.00' }),
      ordem({ numero: 12, estadoProducao: 'concluida', concluidaEm: dias(1), precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ numero: 13, estadoProducao: 'concluida', concluidaEm: dias(1), precoFinal: '80.00', totalRecebido: '79.99' }),
      ordem({ numero: 14, estadoProducao: 'cancelada', concluidaEm: dias(1), precoFinal: '80.00' }),
    ], agora)
    expect(fila.aCobrar.map((o) => [o.numero, o.saldo])).toEqual([[11, '2528.00'], [10, '200.00']])
    expect(fila.totalACobrar).toBe('2728.00')
  })
  it('fila vazia', () => {
    expect(classificarFila([], agora)).toEqual({ paradas: [], aCobrar: [], totalACobrar: '0.00' })
  })
  it('aceita outro limite de dias', () => {
    expect(classificarFila([ordem({ numero: 1, abertaEm: dias(3) })], agora, 2).paradas).toHaveLength(1)
  })
})
