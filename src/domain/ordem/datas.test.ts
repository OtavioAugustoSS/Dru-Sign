import { describe, it, expect } from 'vitest'
import { formatarDataCalendario, formatarDataHora, formatarDataLonga, lerDataCalendario } from './datas'

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
