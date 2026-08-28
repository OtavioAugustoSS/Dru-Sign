import { prisma } from '@/infra/db/prisma'
import { normalizarTelefone } from '@/domain/clientes/telefone'
import { normalizarDocumento } from '@/domain/clientes/documento'

export interface DadosCliente {
  nome: string
  apelido?: string | null
  /** Como digitado; e normalizado para digitos aqui. */
  documento?: string | null
  email?: string | null
  contato?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  observacoes?: string | null
  /** Como digitados; vazios sao ignorados. */
  telefones: string[]
}

export interface TelefoneResumo {
  original: string
  normalizado: string | null
  inferido: boolean
}

export interface ClienteResumo {
  id: string
  nome: string
  apelido: string | null
  documento: string | null
  arquivadoEm: Date | null
  telefones: TelefoneResumo[]
}

export interface ClienteCompleto extends ClienteResumo {
  codigoLegado: number | null
  email: string | null
  contato: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  observacoes: string | null
  criadoEm: Date
  atualizadoEm: Date
}

export interface ExtrasImportacao {
  codigoLegado?: number
  arquivadoEm?: Date | null
  criadoEm?: Date
}

const LIMITE_PADRAO = 50

const SELECAO_TELEFONE = {
  select: { original: true, normalizado: true, inferido: true },
  orderBy: { ordem: 'asc' },
} as const

const SELECAO_RESUMO = {
  id: true,
  nome: true,
  apelido: true,
  documento: true,
  arquivadoEm: true,
  telefones: SELECAO_TELEFONE,
} as const

const SELECAO_COMPLETA = {
  ...SELECAO_RESUMO,
  codigoLegado: true,
  email: true,
  contato: true,
  endereco: true,
  bairro: true,
  cidade: true,
  uf: true,
  cep: true,
  observacoes: true,
  criadoEm: true,
  atualizadoEm: true,
} as const

function limpar(v: string | null | undefined): string | null {
  const t = v?.trim() ?? ''
  return t === '' ? null : t
}

function colunas(dados: DadosCliente) {
  return {
    nome: dados.nome.trim(),
    apelido: limpar(dados.apelido),
    documento: normalizarDocumento(dados.documento ?? '')?.digitos ?? null,
    email: limpar(dados.email),
    contato: limpar(dados.contato),
    endereco: limpar(dados.endereco),
    bairro: limpar(dados.bairro),
    cidade: limpar(dados.cidade),
    uf: limpar(dados.uf)?.toUpperCase().slice(0, 2) ?? null,
    cep: limpar(dados.cep),
    observacoes: limpar(dados.observacoes),
  }
}

function telefonesParaCriar(empresaId: string, telefones: string[]) {
  const vistos = new Set<string>()
  return telefones
    .map((t) => t.trim())
    .filter((t) => t !== '' && !vistos.has(t) && vistos.add(t))
    .map((original, ordem) => {
      const n = normalizarTelefone(original)
      return { empresaId, original: original.slice(0, 20), normalizado: n.normalizado, inferido: n.inferido, ordem }
    })
}

/** As linhas prontas para gravar, sem gravar: a importacao em lote usa isto com createMany. */
export function prepararLinhas(empresaId: string, dados: DadosCliente, extras: ExtrasImportacao = {}) {
  return {
    cliente: {
      empresaId,
      ...colunas(dados),
      codigoLegado: extras.codigoLegado ?? null,
      arquivadoEm: extras.arquivadoEm ?? null,
      ...(extras.criadoEm ? { criadoEm: extras.criadoEm } : {}),
    },
    telefones: telefonesParaCriar(empresaId, dados.telefones),
  }
}

export async function criarCliente(
  empresaId: string,
  dados: DadosCliente,
  extras: ExtrasImportacao = {},
): Promise<ClienteCompleto> {
  const linhas = prepararLinhas(empresaId, dados, extras)
  return prisma.cliente.create({
    data: { ...linhas.cliente, telefones: { create: linhas.telefones } },
    select: SELECAO_COMPLETA,
  })
}

/** Troca a lista de telefones inteira: telefone e atributo do cadastro, nao documento. */
export async function atualizarCliente(empresaId: string, id: string, dados: DadosCliente): Promise<ClienteCompleto> {
  const [, atualizado] = await prisma.$transaction([
    prisma.telefoneCliente.deleteMany({ where: { clienteId: id, empresaId } }),
    prisma.cliente.update({
      where: { id, empresaId },
      data: { ...colunas(dados), telefones: { create: telefonesParaCriar(empresaId, dados.telefones) } },
      select: SELECAO_COMPLETA,
    }),
  ])
  return atualizado
}

export async function arquivarCliente(empresaId: string, id: string): Promise<void> {
  await prisma.cliente.update({ where: { id, empresaId }, data: { arquivadoEm: new Date() } })
}

export async function reativarCliente(empresaId: string, id: string): Promise<void> {
  await prisma.cliente.update({ where: { id, empresaId }, data: { arquivadoEm: null } })
}

export async function obterCliente(empresaId: string, id: string): Promise<ClienteCompleto | null> {
  return prisma.cliente.findFirst({ where: { id, empresaId }, select: SELECAO_COMPLETA })
}

export interface OpcoesBusca {
  incluirArquivados?: boolean
  limite?: number
}

/** Nome ou apelido (sem diferenciar caixa); com 4+ digitos no termo, tambem telefone e documento. */
export async function buscarClientes(
  empresaId: string,
  termo: string,
  opcoes: OpcoesBusca = {},
): Promise<ClienteResumo[]> {
  const texto = termo.trim()
  const digitos = texto.replace(/\D/g, '')
  const filtroArquivo = opcoes.incluirArquivados ? {} : { arquivadoEm: null }

  const porTexto = texto === '' ? [] : [
    { nome: { contains: texto, mode: 'insensitive' as const } },
    { apelido: { contains: texto, mode: 'insensitive' as const } },
  ]
  const porDigitos = digitos.length >= 4 ? [
    { telefones: { some: { normalizado: { contains: digitos } } } },
    { documento: { contains: digitos } },
  ] : []
  const ou = [...porTexto, ...porDigitos]

  return prisma.cliente.findMany({
    where: { empresaId, ...filtroArquivo, ...(ou.length > 0 ? { OR: ou } : {}) },
    orderBy: { nome: 'asc' },
    take: opcoes.limite ?? LIMITE_PADRAO,
    select: SELECAO_RESUMO,
  })
}

/** Quem ja tem algum destes telefones (normalizados). Para o aviso de duplicidade ao cadastrar. */
export async function clientesComTelefone(
  empresaId: string,
  telefones: string[],
  excetoId?: string,
): Promise<ClienteResumo[]> {
  const normalizados = telefones
    .map((t) => normalizarTelefone(t).normalizado)
    .filter((n): n is string => n !== null)
  if (normalizados.length === 0) return []

  return prisma.cliente.findMany({
    where: {
      empresaId,
      ...(excetoId ? { id: { not: excetoId } } : {}),
      telefones: { some: { normalizado: { in: normalizados } } },
    },
    orderBy: { nome: 'asc' },
    select: SELECAO_RESUMO,
  })
}
