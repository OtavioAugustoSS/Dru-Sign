import type { TipoConta } from './lancamento'

export interface ContaLegado {
  codigo: number
  nome: string
  nivel: number
  tipo: TipoConta
  /** NOMENIVEL do legado: CUSTO GERAL, DESPESAS, CUSTO FINANCEIRO, DESPESAS COM VEICULO, RECEITA GERAL, COMPRAS. */
  grupo: string
}

export const GRUPO_PADRAO = 'SEM GRUPO'

/** As 48 contas entram como estao, inclusive as pessoais dos socios (spec, secao 4). */
export function converterContaLegado(v: Record<string, string | number | null>): ContaLegado {
  const codigo = typeof v.CONTA === 'number' ? v.CONTA : Number(v.CONTA)
  if (!Number.isInteger(codigo) || codigo <= 0) throw new Error(`conta sem codigo: ${JSON.stringify(v)}`)
  const nome = String(v.NOME ?? '').trim()
  if (nome === '') throw new Error(`conta ${codigo} sem nome`)
  const tipo = v.TIPO === 'R' ? 'receita' : v.TIPO === 'D' ? 'despesa' : null
  if (tipo === null) throw new Error(`conta ${codigo}: tipo desconhecido "${String(v.TIPO)}"`)
  const nivel = typeof v.NIVEL === 'number' && Number.isInteger(v.NIVEL) ? v.NIVEL : 0
  const grupo = String(v.NOMENIVEL ?? '').trim() || GRUPO_PADRAO
  return { codigo, nome, nivel, tipo, grupo }
}
