import { describe, it, expect } from 'vitest'
import { haQuantosDias } from './tempo'

/** Meio-dia em São Paulo, para os casos não dependerem da virada do dia. */
const agora = new Date('2026-09-01T15:00:00.000Z')

describe('haQuantosDias', () => {
  it.each([
    ['2026-09-01T13:00:00.000Z', 'hoje'],
    ['2026-08-31T13:00:00.000Z', 'ontem'],
    ['2026-08-30T13:00:00.000Z', 'há 2 dias'],
    ['2026-07-23T13:00:00.000Z', 'há 40 dias'],
  ])('%s -> %s', (iso, esperado) => {
    expect(haQuantosDias(iso, agora)).toBe(esperado)
  })

  /*
   * Conta por DIA DE CALENDÁRIO, não por 24 horas: uma ordem concluída às 23h de
   * ontem foi concluída ontem, mesmo que tenham passado só duas horas. É como a
   * pessoa no balcão conta.
   */
  it('a virada do dia conta, e nao as 24 horas', () => {
    const doisDaManha = new Date('2026-09-01T05:00:00.000Z') // 01/09 02:00 em São Paulo
    // Uma hora antes, ainda no dia 01.
    expect(haQuantosDias('2026-09-01T04:00:00.000Z', doisDaManha)).toBe('hoje')
    // Três horas antes, mas já do outro lado da meia-noite: 31/08 às 23:00.
    expect(haQuantosDias('2026-09-01T02:00:00.000Z', doisDaManha)).toBe('ontem')
  })

  /* Data no futuro não vira "há -1 dias": a ordem foi concluída hoje e pronto. */
  it('data adiante nao produz numero negativo', () => {
    expect(haQuantosDias('2026-09-05T13:00:00.000Z', agora)).toBe('hoje')
  })
})
