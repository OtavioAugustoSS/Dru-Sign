import { describe, expect, it } from 'vitest'
import { atalhoAtivo, periodosUsuais } from './periodos'

/** 15 de março de 2026, 10h em São Paulo. */
const MARCO = new Date('2026-03-15T13:00:00.000Z')

function porChave(agora: Date) {
  return Object.fromEntries(periodosUsuais(agora).map((p) => [p.chave, `${p.de}..${p.ate}`]))
}

describe('períodos usuais', () => {
  it('cobre hoje, janelas móveis, mês, mês passado e os dois anos', () => {
    expect(porChave(MARCO)).toEqual({
      hoje: '2026-03-15..2026-03-15',
      // 7 dias CONTANDO hoje: 9 a 15 são sete dias.
      '7dias': '2026-03-09..2026-03-15',
      '30dias': '2026-02-14..2026-03-15',
      mes: '2026-03-01..2026-03-31',
      mespassado: '2026-02-01..2026-02-28',
      ano: '2026-01-01..2026-12-31',
      anopassado: '2025-01-01..2025-12-31',
    })
  })

  it('em janeiro, "mês passado" volta um ano', () => {
    expect(porChave(new Date('2026-01-05T13:00:00.000Z')).mespassado).toBe('2025-12-01..2025-12-31')
  })

  it('acerta o último dia de fevereiro em ano bissexto', () => {
    expect(porChave(new Date('2024-03-10T13:00:00.000Z')).mespassado).toBe('2024-02-01..2024-02-29')
  })

  it('depois das 21h em São Paulo o dia ainda é o de cá, não o de Greenwich', () => {
    // 01/03 às 00:30 UTC é 28/02 às 21:30 na loja.
    expect(porChave(new Date('2026-03-01T00:30:00.000Z')).hoje).toBe('2026-02-28..2026-02-28')
  })

  it('marca o atalho em vigor, e nenhum quando as datas foram digitadas na mão', () => {
    const p = periodosUsuais(MARCO)
    expect(atalhoAtivo(p, '2026-03-01', '2026-03-31')).toBe('mes')
    expect(atalhoAtivo(p, '2026-03-15', '2026-03-15')).toBe('hoje')
    expect(atalhoAtivo(p, '2026-03-02', '2026-03-19')).toBeNull()
  })
})
