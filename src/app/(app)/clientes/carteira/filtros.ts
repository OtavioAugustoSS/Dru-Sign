import { dinheiro } from '@/domain/precificacao/dinheiro'
import type { GrupoCarteira, Recencia } from '@/domain/clientes/carteira'

/**
 * O filtro da carteira, longe do JSX da tela.
 *
 * Roda em memoria de proposito: `carregarCarteira` ja precisa ler os 3.220
 * cadastros e as 18.443 ordens do arquivo para agrupar por documento, entao o
 * recorte sai de graca sobre os 1.066 grupos que sobram. Filtrar no banco
 * exigiria refazer o agrupamento em SQL para ganhar milissegundos.
 */

export type Situacao = 'todas' | Recencia

export const SITUACOES: Array<{ valor: Situacao; rotulo: string }> = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'ativo', rotulo: 'Ativos — compraram nos últimos 6 meses' },
  { valor: 'adormecido', rotulo: 'Adormecidos — de 6 a 24 meses' },
  { valor: 'perdido', rotulo: 'Perdidos — mais de 2 anos' },
]

/** Faixas em vez de campo livre: a pergunta e "quem e grande", nao "quem passou de 1.734". */
export const MINIMOS: Array<{ valor: string; rotulo: string }> = [
  { valor: '', rotulo: 'Qualquer valor' },
  { valor: '1000', rotulo: 'Acima de R$ 1.000' },
  { valor: '5000', rotulo: 'Acima de R$ 5.000' },
  { valor: '20000', rotulo: 'Acima de R$ 20.000' },
  { valor: '50000', rotulo: 'Acima de R$ 50.000' },
]

export type Ordem = 'faturado' | 'recente' | 'antiga' | 'ordens' | 'nome'

export const ORDENS: Array<{ valor: Ordem; rotulo: string }> = [
  { valor: 'faturado', rotulo: 'Quem mais faturou' },
  { valor: 'recente', rotulo: 'Comprou mais recentemente' },
  { valor: 'antiga', rotulo: 'Sumiu há mais tempo' },
  { valor: 'ordens', rotulo: 'Mais ordens' },
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
]

export interface Filtros {
  q: string
  situacao: Situacao
  minimo: string
  cidade: string
  de: string
  ate: string
  incluirArquivados: boolean
  ordem: Ordem
}

export function lerFiltros(p: Record<string, string | undefined>): Filtros {
  const situacao = SITUACOES.some((s) => s.valor === p.situacao) ? (p.situacao as Situacao) : 'todas'
  const ordem = ORDENS.some((o) => o.valor === p.ordem) ? (p.ordem as Ordem) : 'faturado'
  return {
    q: (p.q ?? '').trim(),
    situacao,
    minimo: MINIMOS.some((m) => m.valor === p.minimo) ? (p.minimo as string) : '',
    cidade: (p.cidade ?? '').trim(),
    de: p.de ?? '',
    ate: p.ate ?? '',
    incluirArquivados: p.arquivados !== '0',
    ordem,
  }
}

/** Os parametros de volta ao endereco, para paginar e ordenar sem perder o filtro. */
export function parametrosDe(f: Filtros): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    situacao: f.situacao === 'todas' ? undefined : f.situacao,
    minimo: f.minimo || undefined,
    cidade: f.cidade || undefined,
    de: f.de || undefined,
    ate: f.ate || undefined,
    arquivados: f.incluirArquivados ? undefined : '0',
    ordem: f.ordem === 'faturado' ? undefined : f.ordem,
  }
}

export function estaFiltrando(f: Filtros): boolean {
  return f.q !== '' || f.situacao !== 'todas' || f.minimo !== '' || f.cidade !== '' || f.de !== '' || f.ate !== '' || !f.incluirArquivados
}

function semAcento(t: string): string {
  // Escapes, e nao os caracteres combinantes literais: eles somem em copia e cola.
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

interface Contexto {
  /** Cidade por id de cadastro; o grupo herda a do primeiro que tiver uma. */
  cidades: Map<string, string>
  arquivados: Set<string>
}

export function cidadeDo(g: GrupoCarteira, cidades: Map<string, string>): string | null {
  for (const id of g.clienteIds) {
    const c = cidades.get(id)
    if (c) return c
  }
  return null
}

export function aplicar(grupos: GrupoCarteira[], f: Filtros, ctx: Contexto): GrupoCarteira[] {
  const alvo = semAcento(f.q)
  const minimo = f.minimo === '' ? null : dinheiro(f.minimo)

  const filtrados = grupos.filter((g) => {
    if (f.situacao !== 'todas' && g.recencia !== f.situacao) return false
    if (minimo && dinheiro(g.faturado).lt(minimo)) return false
    // A data do grupo e ISO; `de`/`ate` sao 'AAAA-MM-DD'. Comparar como texto
    // funciona porque o ISO comeca pela data, e o `ate` compara com o dia
    // seguinte para incluir o proprio dia inteiro.
    if (f.de && g.ultimaOrdemEm.slice(0, 10) < f.de) return false
    if (f.ate && g.ultimaOrdemEm.slice(0, 10) > f.ate) return false
    if (f.cidade && cidadeDo(g, ctx.cidades) !== f.cidade) return false
    if (!f.incluirArquivados && g.clienteIds.every((id) => ctx.arquivados.has(id))) return false
    if (alvo) {
      const texto = semAcento(`${g.nome} ${g.apelido ?? ''} ${g.documento ?? ''}`)
      if (!texto.includes(alvo)) return false
    }
    return true
  })

  const porFaturado = (a: GrupoCarteira, b: GrupoCarteira) => dinheiro(b.faturado).comparedTo(dinheiro(a.faturado))
  const ordenado = [...filtrados]
  if (f.ordem === 'recente') ordenado.sort((a, b) => b.ultimaOrdemEm.localeCompare(a.ultimaOrdemEm) || porFaturado(a, b))
  else if (f.ordem === 'antiga') ordenado.sort((a, b) => a.ultimaOrdemEm.localeCompare(b.ultimaOrdemEm) || porFaturado(a, b))
  else if (f.ordem === 'ordens') ordenado.sort((a, b) => b.ordens - a.ordens || porFaturado(a, b))
  else if (f.ordem === 'nome') ordenado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  else ordenado.sort(porFaturado)
  return ordenado
}

/** Quanto o recorte representa do faturamento inteiro da carteira. */
export function fatiaDoRecorte(recorte: GrupoCarteira[], totalGeral: string): { soma: string; pct: string } {
  const soma = recorte.reduce((s, g) => s.plus(dinheiro(g.faturado)), dinheiro(0))
  const total = dinheiro(totalGeral)
  return { soma: soma.toFixed(2), pct: total.isZero() ? '0.0' : soma.dividedBy(total).times(100).toFixed(1) }
}
