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

export async function listarMateriais(
  empresaId: string,
  opcoes: { incluirInativos?: boolean } = {},
): Promise<MaterialResumo[]> {
  const linhas = await prisma.material.findMany({
    where: { empresaId, ...(opcoes.incluirInativos ? {} : { ativo: true }) },
    orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    select: SELECAO,
  })
  return linhas.map(paraResumo)
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
