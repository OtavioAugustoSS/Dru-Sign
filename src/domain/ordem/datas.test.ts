import { describe, it, expect } from 'vitest'
import { formatarDataCalendario, formatarDataHora, formatarDataLonga, lerDataCalendario, hojeCalendario, mesCalendario, limitesDoDia } from './datas'

describe('datas', () => {
  it('data de calendario (@db.Date, meia-noite UTC) nao muda de dia no fuso da loja', () => {
    expect(formatarDataCalendario(new Date('2026-09-04T00:00:00.000Z'))).toBe('04/09/2026')
    expect(formatarDataLonga(new Date('2026-09-04T00:00:00.000Z'))).toBe('4 de setembro')
  })

  it('data e hora (timestamptz) no fuso da loja: 22h em Unai nao vira o dia seguinte', () => {
    expect(formatarDataHora(new Date('2026-08-28T01:30:00.000Z'))).toBe('27/08/2026 22:30')
  })

  it('le AAAA-MM-DD do input de data e recusa data invalida', () => {
    expect(lerDataCalendario('2026-09-04')?.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    expect(lerDataCalendario('2026-02-30')).toBeNull()
    expect(lerDataCalendario('4/9/2026')).toBeNull()
  })
})

describe('calendario em Sao Paulo', () => {
  it('hojeCalendario vira o dia em Sao Paulo, nao em UTC', () => {
    expect(hojeCalendario(new Date('2026-08-29T02:30:00.000Z'))).toBe('2026-08-28') // 23:30 do dia 28 em SP
    expect(hojeCalendario(new Date('2026-08-29T03:00:00.000Z'))).toBe('2026-08-29')
  })
  it('mesCalendario da o primeiro e o ultimo dia do mes', () => {
    expect(mesCalendario(new Date('2026-08-29T15:00:00.000Z'))).toEqual({ de: '2026-08-01', ate: '2026-08-31' })
    expect(mesCalendario(new Date('2026-02-10T15:00:00.000Z'))).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(mesCalendario(new Date('2026-01-01T01:00:00.000Z'))).toEqual({ de: '2025-12-01', ate: '2025-12-31' }) // ainda 31/12 em SP
  })
  it('limitesDoDia cobre do 00:00 de "de" ao 00:00 do dia seguinte a "ate", em Sao Paulo (UTC-3)', () => {
    expect(limitesDoDia('2026-08-01', '2026-08-31')).toEqual({ inicio: new Date('2026-08-01T03:00:00.000Z'), fim: new Date('2026-09-01T03:00:00.000Z') })
    expect(limitesDoDia('2026-08-31', '2026-08-01')).toBeNull()
    expect(limitesDoDia('x', '2026-08-01')).toBeNull()
  })
})
