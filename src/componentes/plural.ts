/**
 * "1 ordem", "2 ordens" -- nunca "1 ordens".
 *
 * Existe porque o erro ja apareceu tres vezes em telas diferentes, sempre do
 * mesmo jeito: `{lista.length} ordens`. Numa loja onde a maioria dos clientes
 * tem uma ordem so, "1 ordens" e o que a pessoa mais ve.
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}
