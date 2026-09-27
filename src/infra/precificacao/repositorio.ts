import type { Decimal } from '@/domain/precificacao/dinheiro'
import { calcularVenda } from '@/domain/precificacao/familia'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import { prisma } from '@/infra/db/prisma'
import { paraBanco, paraDominio } from '@/infra/db/decimal'

export interface DadosFamilia {
  nome: string
  unidadePadrao: UnidadeCobranca
  margem: Decimal
  arredondamento: Decimal
  minimoCobranca: Decimal | null
}

export interface FamiliaResumo extends DadosFamilia {
  id: string
  ativo: boolean
  /** Quantos materiais usam esta familia. */
  materiais: number
  /** Quantos ficam de fora do recalculo, e por que. */
  travados: number
  semCusto: number
  /** A faixa que a familia produz hoje. Null quando nenhum material tem custo. */
  custoMin: Decimal | null
  custoMax: Decimal | null
  vendaMin: Decimal | null
  vendaMax: Decimal | null
}

/** Por que um material entra ou nao no recalculo -- a tela mostra isso linha a linha. */
export type MotivoSimulacao = 'calculado' | 'travado' | 'sem custo'

export interface LinhaSimulacao {
  id: string
  nome: string
  custo: Decimal | null
  precoAtual: Decimal
  /** Null quando o material nao entra no recalculo. */
  precoNovo: Decimal | null
  motivo: MotivoSimulacao
  /** Se o preco muda de fato. Serve para nao gravar historico de nao-mudanca. */
  muda: boolean
}

export interface Simulacao {
  linhas: LinhaSimulacao[]
  /** Quantos precos mudariam de valor. */
  afetados: number
  travados: number
  semCusto: number
}

const SELECAO = {
  id: true,
  nome: true,
  unidadePadrao: true,
  margem: true,
  arredondamento: true,
  minimoCobranca: true,
  ativo: true,
} as const

type LinhaFamilia = {
  id: string
  nome: string
  unidadePadrao: UnidadeCobranca
  margem: Parameters<typeof paraDominio>[0]
  arredondamento: Parameters<typeof paraDominio>[0]
  minimoCobranca: Parameters<typeof paraDominio>[0] | null
  ativo: boolean
}

function paraResumoBase(l: LinhaFamilia) {
  return {
    id: l.id,
    nome: l.nome,
    unidadePadrao: l.unidadePadrao,
    margem: paraDominio(l.margem),
    arredondamento: paraDominio(l.arredondamento),
    minimoCobranca: l.minimoCobranca === null ? null : paraDominio(l.minimoCobranca),
    ativo: l.ativo,
  }
}

function colunas(dados: DadosFamilia) {
  return {
    nome: dados.nome.trim(),
    unidadePadrao: dados.unidadePadrao,
    margem: paraBanco(dados.margem),
    arredondamento: paraBanco(dados.arredondamento),
    minimoCobranca: dados.minimoCobranca === null ? null : paraBanco(dados.minimoCobranca),
  }
}

type LinhaMaterialDaFamilia = {
  familiaPrecoId: string | null
  custo: Parameters<typeof paraDominio>[0] | null
  preco: Parameters<typeof paraDominio>[0]
  precoTravado: boolean
}

const menor = (v: Decimal[]) => (v.length === 0 ? null : v.reduce((a, b) => (a.lt(b) ? a : b)))
const maior = (v: Decimal[]) => (v.length === 0 ? null : v.reduce((a, b) => (a.gt(b) ? a : b)))

/** O retrato do que a familia produz hoje, a partir dos materiais que apontam para ela. */
function comRetrato(base: ReturnType<typeof paraResumoBase>, todos: LinhaMaterialDaFamilia[]): FamiliaResumo {
  const meus = todos.filter((m) => m.familiaPrecoId === base.id)
  // A faixa cobre so os materiais que a familia realmente precifica. Incluir os sem custo
  // puxaria a venda minima para R$ 0,00 -- eles estao cadastrados esperando preco, e
  // mostrar zero como piso da familia seria mentira sobre o que a empresa cobra.
  const comCusto = meus.filter((m) => m.custo !== null)
  const custos = comCusto.map((m) => paraDominio(m.custo!))
  const vendas = comCusto.map((m) => paraDominio(m.preco))
  return {
    ...base,
    materiais: meus.length,
    travados: meus.filter((m) => m.precoTravado).length,
    semCusto: meus.filter((m) => !m.precoTravado && m.custo === null).length,
    custoMin: menor(custos),
    custoMax: maior(custos),
    vendaMin: menor(vendas),
    vendaMax: maior(vendas),
  }
}

/**
 * As familias com o retrato do que cada uma produz hoje: quantos materiais, quantos
 * escapam do recalculo, e a faixa de custo e venda. E o que a tela de precificacao
 * mostra sem precisar abrir cada familia.
 */
export async function listarFamilias(empresaId: string): Promise<FamiliaResumo[]> {
  const [familias, materiais] = await Promise.all([
    prisma.familiaPreco.findMany({ where: { empresaId }, orderBy: { nome: 'asc' }, select: SELECAO }),
    prisma.material.findMany({
      where: { empresaId, familiaPrecoId: { not: null } },
      select: { familiaPrecoId: true, custo: true, preco: true, precoTravado: true },
    }),
  ])
  return familias.map((f) => comRetrato(paraResumoBase(f), materiais))
}

export async function obterFamilia(empresaId: string, id: string): Promise<FamiliaResumo | null> {
  const [f, materiais] = await Promise.all([
    prisma.familiaPreco.findFirst({ where: { id, empresaId }, select: SELECAO }),
    prisma.material.findMany({
      where: { empresaId, familiaPrecoId: id },
      select: { familiaPrecoId: true, custo: true, preco: true, precoTravado: true },
    }),
  ])
  return f === null ? null : comRetrato(paraResumoBase(f), materiais)
}

export async function criarFamilia(empresaId: string, dados: DadosFamilia): Promise<{ id: string }> {
  return prisma.familiaPreco.create({ data: { empresaId, ...colunas(dados) }, select: { id: true } })
}

/**
 * O que aconteceria com os precos se a familia passasse a valer estes parametros.
 *
 * Nao grava nada: e o que a tela mostra antes de aplicar, para uma virgula errada nao
 * virar 82 precos errados sem ninguem ver.
 */
export async function simular(
  empresaId: string,
  familiaId: string,
  parametros: Pick<DadosFamilia, 'margem' | 'arredondamento'>,
): Promise<Simulacao> {
  const materiais = await prisma.material.findMany({
    where: { empresaId, familiaPrecoId: familiaId },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, custo: true, preco: true, precoTravado: true },
  })

  const linhas: LinhaSimulacao[] = materiais.map((m) => {
    const precoAtual = paraDominio(m.preco)
    const custo = m.custo === null ? null : paraDominio(m.custo)
    if (m.precoTravado) {
      return { id: m.id, nome: m.nome, custo, precoAtual, precoNovo: null, motivo: 'travado', muda: false }
    }
    if (custo === null) {
      return { id: m.id, nome: m.nome, custo, precoAtual, precoNovo: null, motivo: 'sem custo', muda: false }
    }
    const precoNovo = calcularVenda({
      custo: custo.toFixed(),
      margem: parametros.margem.toFixed(),
      arredondamento: parametros.arredondamento.toFixed(),
    })
    return { id: m.id, nome: m.nome, custo, precoAtual, precoNovo, motivo: 'calculado', muda: !precoNovo.equals(precoAtual) }
  })

  return {
    linhas,
    afetados: linhas.filter((l) => l.muda).length,
    travados: linhas.filter((l) => l.motivo === 'travado').length,
    semCusto: linhas.filter((l) => l.motivo === 'sem custo').length,
  }
}

/**
 * Grava os parametros e recalcula os precos numa transacao so.
 *
 * Tudo junto de proposito: se o recalculo falhasse depois de salvar a margem, a familia
 * ficaria dizendo um preco que os materiais nao praticam.
 */
export async function aplicar(
  empresaId: string,
  familiaId: string,
  dados: DadosFamilia,
  usuarioId: string,
): Promise<{ afetados: number; pulados: number }> {
  const previa = await simular(empresaId, familiaId, dados)
  const mudam = previa.linhas.filter((l) => l.muda && l.precoNovo !== null)

  await prisma.$transaction([
    prisma.familiaPreco.update({ where: { id: familiaId, empresaId }, data: colunas(dados) }),
    ...mudam.flatMap((l) => [
      prisma.material.update({ where: { id: l.id, empresaId }, data: { preco: paraBanco(l.precoNovo!) } }),
      prisma.historicoPreco.create({
        data: {
          empresaId,
          materialId: l.id,
          de: paraBanco(l.precoAtual),
          para: paraBanco(l.precoNovo!),
          motivo: 'margem da família',
          usuarioId,
        },
      }),
    ]),
  ])

  return { afetados: mudam.length, pulados: previa.travados + previa.semCusto }
}

/** Uma familia com material vinculado nao some: o vinculo some junto e ninguem percebe. */
export async function excluirFamilia(empresaId: string, id: string): Promise<{ excluida: boolean; materiais: number }> {
  const materiais = await prisma.material.count({ where: { empresaId, familiaPrecoId: id } })
  if (materiais > 0) return { excluida: false, materiais }
  await prisma.familiaPreco.deleteMany({ where: { id, empresaId } })
  return { excluida: true, materiais: 0 }
}

/** O historico de um material, do mais recente para o mais antigo. */
export async function historicoDoMaterial(
  empresaId: string,
  materialId: string,
  limite = 20,
): Promise<{ de: Decimal; para: Decimal; motivo: string; usuario: string | null; criadoEm: Date }[]> {
  const linhas = await prisma.historicoPreco.findMany({
    where: { empresaId, materialId },
    orderBy: { criadoEm: 'desc' },
    take: limite,
    select: { de: true, para: true, motivo: true, criadoEm: true, usuario: { select: { nome: true } } },
  })
  return linhas.map((l) => ({
    de: paraDominio(l.de),
    para: paraDominio(l.para),
    motivo: l.motivo,
    usuario: l.usuario?.nome ?? null,
    criadoEm: l.criadoEm,
  }))
}

/** Registra uma mudanca de preco feita fora do recalculo de familia. */
export async function registrarMudancaDePreco(
  empresaId: string,
  materialId: string,
  de: Decimal,
  para: Decimal,
  motivo: string,
  usuarioId: string,
): Promise<void> {
  if (de.equals(para)) return
  await prisma.historicoPreco.create({
    data: { empresaId, materialId, de: paraBanco(de), para: paraBanco(para), motivo, usuarioId },
  })
}

