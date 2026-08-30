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
  /* Entra no resumo porque a lista mostra: a loja atende Unai e a regiao, e
     saber que o cliente e de Bonfinopolis muda o prazo que se promete. */
  cidade: string | null
  arquivadoEm: Date | null
  telefones: TelefoneResumo[]
}

export interface ClienteCompleto extends ClienteResumo {
  codigoLegado: number | null
  email: string | null
  contato: string | null
  endereco: string | null
  bairro: string | null
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
  /* A cidade entra na lista porque a loja atende Unai e a regiao: saber que o
     cliente e de Bonfinopolis muda o prazo que se promete no balcao. */
  cidade: true,
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

/**
 * Apara as pontas E colapsa os espacos do meio.
 *
 * O colapso importa mais do que parece. O sistema antigo gravava nome em campo
 * de largura fixa e a digitacao deixou espaco duplo em boa parte dos 3.219
 * cadastros -- "DIRCEU JULIO GATO  FAZ BURITI  UNAI-MG". A busca usa `contains`,
 * entao quem digita o nome do jeito natural, com um espaco so, NAO ACHA o
 * cliente. E quem nao acha, cadastra de novo: e assim que o legado chegou a
 * 2.734 cadastros para 1.847 documentos. O espaco duplo nao e informacao.
 */
function limpar(v: string | null | undefined): string | null {
  const t = v?.trim().replace(/\s+/g, ' ') ?? ''
  return t === '' ? null : t
}

function colunas(dados: DadosCliente) {
  return {
    nome: dados.nome.trim().replace(/\s+/g, ' '),
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
      return { empresaId, original, normalizado: n.normalizado, inferido: n.inferido, ordem }
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

/** De onde veio o cadastro. O sistema antigo trouxe 3.219; o resto nasceu aqui. */
export type OrigemCliente = 'todos' | 'novos' | 'legado'

export interface OpcoesBusca {
  incluirArquivados?: boolean
  origem?: OrigemCliente
  /** Nome exato da cidade, como esta gravado. Vem de uma lista da propria tela. */
  cidade?: string
  /**
   * 'com' ou 'sem' telefone discavel.
   *
   * A importacao achou 1.323 cadastros sem numero que se possa discar -- nome
   * de cliente que nao da para ligar e cadastro pela metade, e ate agora nao
   * havia como listar quais sao para completar.
   */
  telefone?: string
  /** 'nome' (padrao) ou 'cidade'. */
  ordenar?: string
  direcao?: 'asc' | 'desc'
  limite?: number
  /** 1 e a primeira. Junto com `limite`, decide o trecho que a tela mostra. */
  pagina?: number
}

/** Nome ou apelido (sem diferenciar caixa); com 4+ digitos no termo, tambem telefone e documento. */

/** O mesmo filtro para a busca e para a contagem: se divergirem, a paginacao mente. */
function condicaoDeClientes(empresaId: string, termo: string, opcoes: OpcoesBusca) {
  const texto = termo.trim()
  const digitos = texto.replace(/\D/g, '')
  const filtroArquivo = opcoes.incluirArquivados ? {} : { arquivadoEm: null }
  const filtroOrigem =
    opcoes.origem === 'legado' ? { codigoLegado: { not: null } }
    : opcoes.origem === 'novos' ? { codigoLegado: null }
    : {}

  const porTexto = texto === '' ? [] : [
    { nome: { contains: texto, mode: 'insensitive' as const } },
    { apelido: { contains: texto, mode: 'insensitive' as const } },
  ]
  const porDigitos = digitos.length >= 4 ? [
    { telefones: { some: { normalizado: { contains: digitos } } } },
    { documento: { contains: digitos } },
  ] : []
  // Digitado como no cartao do legado, "(38)9968-1168", o numero so bate depois de ganhar o nono digito.
  const telefoneNormalizado = normalizarTelefone(texto).normalizado
  const porTelefoneCompleto = telefoneNormalizado
    ? [{ telefones: { some: { normalizado: telefoneNormalizado } } }]
    : []
  const ou = [...porTexto, ...porDigitos, ...porTelefoneCompleto]

  const filtroCidade = opcoes.cidade ? { cidade: opcoes.cidade } : {}
  const filtroTelefone =
    opcoes.telefone === 'com' ? { telefones: { some: { normalizado: { not: null } } } }
    : opcoes.telefone === 'sem' ? { telefones: { none: { normalizado: { not: null } } } }
    : {}

  return { empresaId, ...filtroArquivo, ...filtroOrigem, ...filtroCidade, ...filtroTelefone, ...(ou.length > 0 ? { OR: ou } : {}) }
}

/** As cidades que os cadastros realmente usam, para o filtro nao oferecer opcao vazia. */
export async function cidadesDeCadastro(empresaId: string): Promise<string[]> {
  const linhas = await prisma.cliente.groupBy({
    by: ['cidade'],
    where: { empresaId, cidade: { not: null } },
    _count: true,
  })
  return linhas
    .map((l) => (l.cidade as string).trim())
    .filter((c) => c !== '')
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Quantos clientes a busca encontra, ignorando a pagina.
 *
 * Separado de `buscarClientes` porque aquela devolve um array e os testes de
 * integracao dependem disso.
 */
export async function contarClientes(empresaId: string, termo: string, opcoes: OpcoesBusca = {}): Promise<number> {
  return prisma.cliente.count({ where: condicaoDeClientes(empresaId, termo, opcoes) })
}

export async function buscarClientes(
  empresaId: string,
  termo: string,
  opcoes: OpcoesBusca = {},
): Promise<ClienteResumo[]> {
  const limite = opcoes.limite ?? LIMITE_PADRAO
  const direcao = opcoes.direcao === 'desc' ? ('desc' as const) : ('asc' as const)
  // Lista curta e fechada: o campo vai direto para o `orderBy`, e campo vindo
  // da URL sem conferencia e campo que a pessoa escolhe digitando no navegador.
  // Nome como desempate: cidade sozinha deixaria a ordem instavel entre paginas.
  const ordem =
    opcoes.ordenar === 'cidade' ? [{ cidade: direcao }, { nome: 'asc' as const }]
    : [{ nome: direcao }]
  return prisma.cliente.findMany({
    where: condicaoDeClientes(empresaId, termo, opcoes),
    orderBy: ordem,
    skip: opcoes.pagina && opcoes.pagina > 1 ? (opcoes.pagina - 1) * limite : 0,
    take: limite,
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


/**
 * Os numeros do alto da tela de clientes.
 *
 * Cada um e tambem um filtro: o cartao leva para a lista ja filtrada, entao o
 * numero nao e enfeite -- e a porta para a lista que ele conta.
 */
export async function contagensDeClientes(empresaId: string): Promise<{
  total: number
  doLegado: number
  cadastradosAqui: number
  arquivados: number
  semTelefone: number
}> {
  const [total, doLegado, arquivados, semTelefone] = await Promise.all([
    prisma.cliente.count({ where: { empresaId, arquivadoEm: null } }),
    prisma.cliente.count({ where: { empresaId, arquivadoEm: null, codigoLegado: { not: null } } }),
    prisma.cliente.count({ where: { empresaId, arquivadoEm: { not: null } } }),
    // Cadastro sem numero que se possa discar: nome de cliente que nao da para
    // ligar e ficha pela metade, e a loja precisa saber quantos sao.
    prisma.cliente.count({ where: { empresaId, arquivadoEm: null, telefones: { none: { normalizado: { not: null } } } } }),
  ])
  return { total, doLegado, cadastradosAqui: total - doLegado, arquivados, semTelefone }
}
