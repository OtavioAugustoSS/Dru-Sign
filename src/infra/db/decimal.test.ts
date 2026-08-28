import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { Prisma } from '@/generated/prisma/client'
import { paraBanco, paraDominio } from './decimal'

describe('conversao de Decimal entre banco e dominio', () => {
  // Prisma.Decimal e um decimal.js empacotado, mas e outra classe: instanceof falha entre eles.
  it.each(['12.3456', '0.0001', '99999999.9999', '0', '1234.5'])('ida e volta preserva %s', (texto) => {
    const dominio = new Decimal(texto)
    const banco = paraBanco(dominio)
    expect(banco).toBeInstanceOf(Prisma.Decimal)
    expect(banco.toFixed()).toBe(dominio.toFixed())

    const volta = paraDominio(banco)
    expect(volta).toBeInstanceOf(Decimal)
    expect(volta.equals(dominio)).toBe(true)
  })

  it('recusa o que nao cabe em numeric(12,4)', () => {
    expect(() => paraBanco(new Decimal('0.12345'))).toThrow(/numeric\(12,4\)/)
    expect(() => paraBanco(new Decimal('100000000'))).toThrow(/numeric\(12,4\)/)
  })

  it('nao passa por ponto flutuante', () => {
    const banco = paraBanco(new Decimal('0.1').plus('0.2'))
    expect(banco.toFixed()).toBe('0.3')
  })
})
