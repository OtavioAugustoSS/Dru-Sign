import type { Decimal } from '@/domain/precificacao/dinheiro'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import { prisma } from '@/infra/db/prisma'
import { paraBanco, paraDominio } from '@/infra/db/decimal'

export { UNIDADES_COBRANCA, rotuloUnidade, ehUnidadeCobranca } from './unidades'

export interface DadosMaterial {
  nome: string
  categoria?: string | null
  preco: Decimal
  unidadeCobranca: UnidadeCobranca
}

export interface MaterialResumo {
  id: string
  nome: string
  categoria: string | null
  preco: Decimal
  unidadeCobranca: UnidadeCobranca
  ativo: boolean
}

const SELECAO = { id: true, nome: true, categoria: true, preco: true, unidadeCobranca: true, ativo: true } as const

type Linha = {
  id: string
  nome: string
  categoria: string | null
  preco: Parameters<typeof paraDominio>[0]
  unidadeCobranca: UnidadeCobranca
  ativo: boolean
}

function paraResumo(l: Linha): MaterialResumo {
  return { ...l, preco: paraDominio(l.preco) }
}

function colunas(dados: DadosMaterial) {
  const categoria = dados.categoria?.trim() ?? ''
  return {
    nome: dados.nome.trim(),
    categoria: categoria === '' ? null : categoria,
    preco: paraBanco(dados.preco),
    unidadeCobranca: dados.unidadeCobranca,
  }
}

export interface FiltrosMateriais {
  incluirInativos?: boolean
  /** Trecho do nome ou da categoria. */
  q?: string
  /** Uma categoria exata, vinda do proprio catalogo. */
  categoria?: string
  limite?: number
  /** 1 e a primeira. */
  pagina?: number
  /** So estas colunas: o valor vem do endereco e vai direto para o `orderBy`. */
  ordenar?: 'nome' | 'categoria' | 'preco'
  direcao?: 'asc' | 'desc'
}

/** O mesmo filtro para a lista e para a contagem: se divergirem, a paginacao mente. */
function condicaoDeMateriais(empresaId: string, f: FiltrosMateriais) {
  const q = f.q?.trim() ?? ''
  return {
    empresaId,
    ...(f.incluirInativos ? {} : { ativo: true }),
    ...(f.categoria ? { categoria: f.categoria } : {}),
    ...(q === '' ? {} : {
      OR: [
        { nome: { contains: q, mode: 'insensitive' as const } },
        { categoria: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }
}

export async function listarMateriais(
  empresaId: string,
  opcoes: FiltrosMateriais = {},
): Promise<MaterialResumo[]> {
  const limite = opcoes.limite
  const linhas = await prisma.material.findMany({
    where: condicaoDeMateriais(empresaId, opcoes),
    // O nome desempata: sem isso, ordenar por preco com valores repetidos
    // devolve a pagina 2 com linhas que ja apareceram na 1.
    orderBy: opcoes.ordenar
      ? [{ [opcoes.ordenar]: opcoes.direcao ?? 'asc' }, { nome: 'asc' }]
      : [{ categoria: 'asc' }, { nome: 'asc' }],
    ...(limite ? { take: limite, skip: opcoes.pagina && opcoes.pagina > 1 ? (opcoes.pagina - 1) * limite : 0 } : {}),
    select: SELECAO,
  })
  return linhas.map(paraResumo)
}

export async function contarMateriais(empresaId: string, opcoes: FiltrosMateriais = {}): Promise<number> {
  return prisma.material.count({ where: condicaoDeMateriais(empresaId, opcoes) })
}

/**
 * As categorias que existem no catalogo, para o filtro nao ser texto livre.
 *
 * Vem do proprio catalogo em vez de uma lista fixa: a loja inventa categoria
 * conforme precisa, e uma lista fixa no codigo envelheceria na primeira semana.
 */
export async function categoriasDeMateriais(empresaId: string): Promise<string[]> {
  const linhas = await prisma.material.findMany({
    where: { empresaId, categoria: { not: null } },
    distinct: ['categoria'],
    orderBy: { categoria: 'asc' },
    select: { categoria: true },
  })
  return linhas.map((l) => l.categoria).filter((c): c is string => c !== null)
}

/** Quantos estao ativos e quantos foram desativados -- os numeros do alto da tela. */
export async function contagensDeMateriais(empresaId: string): Promise<{ ativos: number; inativos: number; categorias: number }> {
  const [ativos, inativos, categorias] = await Promise.all([
    prisma.material.count({ where: { empresaId, ativo: true } }),
    prisma.material.count({ where: { empresaId, ativo: false } }),
    categoriasDeMateriais(empresaId).then((c) => c.length),
  ])
  return { ativos, inativos, categorias }
}

export async function obterMaterial(empresaId: string, id: string): Promise<MaterialResumo | null> {
  const l = await prisma.material.findFirst({ where: { id, empresaId }, select: SELECAO })
  return l ? paraResumo(l) : null
}

export async function criarMaterial(empresaId: string, dados: DadosMaterial): Promise<MaterialResumo> {
  return paraResumo(await prisma.material.create({ data: { empresaId, ...colunas(dados) }, select: SELECAO }))
}

export async function atualizarMaterial(empresaId: string, id: string, dados: DadosMaterial): Promise<MaterialResumo> {
  return paraResumo(await prisma.material.update({ where: { id, empresaId }, data: colunas(dados), select: SELECAO }))
}

export async function definirAtivo(empresaId: string, id: string, ativo: boolean): Promise<void> {
  await prisma.material.update({ where: { id, empresaId }, data: { ativo } })
}
