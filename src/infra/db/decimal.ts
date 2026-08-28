import Decimal from 'decimal.js'
import { Prisma } from '@/generated/prisma/client'

/**
 * Banco -> dominio. Prisma.Decimal e um decimal.js empacotado dentro do Prisma,
 * mas e outra classe: `instanceof` falha e o TypeScript recusa a atribuicao.
 * A conversao e sempre por string; nunca por Number.
 */
export function paraDominio(valor: Prisma.Decimal): Decimal {
  return new Decimal(valor.toFixed())
}

/** Dominio -> banco. `toFixed()` sem argumento e a representacao exata, sem notacao cientifica. */
export function paraBanco(valor: Decimal): Prisma.Decimal {
  return new Prisma.Decimal(valor.toFixed())
}
