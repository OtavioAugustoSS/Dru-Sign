import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

export function dinheiro(v: number | string): Decimal {
  return new Decimal(v)
}

export function arredondarCentavos(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/** numeric(12,4) do banco: ate 8 digitos inteiros e 4 casas decimais. O que nao cabe nao entra. */
export function cabeEmNumeric12x4(d: Decimal): boolean {
  return d.abs().lessThan('100000000') && d.decimalPlaces() <= 4
}
