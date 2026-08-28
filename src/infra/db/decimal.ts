import Decimal from 'decimal.js'
import { cabeEmNumeric12x4 } from '@/domain/precificacao/dinheiro'
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
  // O Postgres arredondaria a 5a casa em silencio e estouraria acima de 8 digitos inteiros: recusar antes.
  if (!cabeEmNumeric12x4(valor)) throw new Error(`valor fora de numeric(12,4): ${valor.toFixed()}`)
  return new Prisma.Decimal(valor.toFixed())
}
