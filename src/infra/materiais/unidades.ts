import type { UnidadeCobranca } from '@/domain/precificacao/tipos'

/** Modulo puro (sem Prisma): o formulario, que roda no navegador, importa daqui. */

export const UNIDADES_COBRANCA: ReadonlyArray<{ valor: UnidadeCobranca; rotulo: string }> = [
  { valor: 'm2', rotulo: 'por m²' },
  { valor: 'unidade', rotulo: 'por unidade' },
  { valor: 'metro_linear', rotulo: 'por metro linear' },
]

export function rotuloUnidade(unidade: UnidadeCobranca): string {
  return UNIDADES_COBRANCA.find((u) => u.valor === unidade)?.rotulo ?? unidade
}

export function ehUnidadeCobranca(v: string): v is UnidadeCobranca {
  return UNIDADES_COBRANCA.some((u) => u.valor === v)
}
