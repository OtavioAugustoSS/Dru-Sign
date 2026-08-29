import { interpretarLinha, normalizarDimensao } from './parser'
import { calcularItem } from './formulas'
import { formatarMoeda } from './moeda'
import { dinheiro } from './dinheiro'
import type { UnidadeCobranca } from './tipos'

/** O que a tela recebe do catalogo: preco como string decimal (Decimal nao atravessa a fronteira). */
export interface MaterialCatalogo {
  id: string
  nome: string
  preco: string
  unidadeCobranca: UnidadeCobranca
}

export type TipoAcrescimo = 'instalacao' | 'deslocamento' | 'frete' | 'imposto'
export type Pendencia = 'valor' | 'quantidade' | 'dimensao' | 'tipo_acrescimo'
export type OrigemUnidade = 'material' | 'padrao' | 'sufixo' | 'escolhida'

export interface ItemResolvido {
  tipo: 'item'
  quantidade: number
  descricao: string
  material: MaterialCatalogo | null
  /** Outros materiais com a mesma pontuacao: a tela oferece a troca. */
  candidatos: MaterialCatalogo[]
  altura?: number
  largura?: number
  unidade: UnidadeCobranca
  origemUnidade: OrigemUnidade
  valorUnitario?: number
  valorDoCatalogo: boolean
  /** O "CD 723,00" do legado: total digitado, usado so para conferir. */
  totalDigitado?: number
  pendencias: Pendencia[]
}

export interface AcrescimoResolvido {
  tipo: 'acrescimo'
  tipoAcrescimo: TipoAcrescimo | null
  descricao: string
  valor?: number
  pendencias: Pendencia[]
}

export type LinhaResolvida = ItemResolvido | AcrescimoResolvido

export interface OpcoesResolucao {
  /** Unidade escolhida pelo operador (select ou Alt+U); vence sufixo e material. */
  unidadeEscolhida?: UnidadeCobranca
  /** Material escolhido a mao; null = descricao livre, sem material. */
  materialEscolhido?: MaterialCatalogo | null
}

const SUFIXO_UNIDADE: Record<string, UnidadeCobranca> = { un: 'unidade', m2: 'm2', ml: 'metro_linear' }
const RE_SUFIXO = /\s*\/(un|m2|ml)\s*$/i
const RE_QTD_COLADA = /^(\d{1,4})(?=[^\d\s.,x×])/i
const VALOR = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}|\d+,\d{2}|\d+)`
/** "CD 723,00", "= 723,00", "TOTAL 723,00" no fim da linha, como o legado datilografava. */
const RE_TOTAL_LEGADO = new RegExp(String.raw`\s+(?:CD|=|TOTAL)\s*${VALOR}\s*$`, 'i')
const RE_VALOR_FIM = new RegExp(String.raw`${VALOR}\s*$`)
/** Palavras que aparecem em qualquer descricao e nao identificam material. */
const STOPWORDS = new Set(['de', 'da', 'do', 'com', 'e', 'em', 'para', 'placa', 'adesivo', 'impresso', 'impressao', 'ades', 'imp', 'mm'])
const TIPOS_ACRESCIMO: TipoAcrescimo[] = ['instalacao', 'deslocamento', 'frete', 'imposto']

export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function tokens(s: string): string[] {
  return normalizarTexto(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
}

/** Pontua cada material pelos tokens da descricao presentes no nome; empate -> nome mais curto. */
export function acharMaterial(
  descricao: string,
  catalogo: MaterialCatalogo[],
): { escolhido: MaterialCatalogo | null; candidatos: MaterialCatalogo[] } {
  const pistas = tokens(descricao).filter((t) => !STOPWORDS.has(t))
  if (pistas.length === 0) return { escolhido: null, candidatos: [] }
  let melhor = 0
  const pontuados: Array<{ m: MaterialCatalogo; p: number }> = []
  for (const m of catalogo) {
    const nome = new Set(tokens(m.nome))
    const p = pistas.filter((t) => nome.has(t)).length
    if (p > 0) pontuados.push({ m, p })
    if (p > melhor) melhor = p
  }
  if (melhor === 0) return { escolhido: null, candidatos: [] }
  const empatados = pontuados.filter((x) => x.p === melhor).map((x) => x.m).sort((a, b) => a.nome.length - b.nome.length)
  return { escolhido: empatados[0] ?? null, candidatos: empatados.slice(1) }
}

function paraNumero(token: string): number {
  return Number(token.replace(/\./g, '').replace(',', '.'))
}

function resolverAcrescimo(texto: string): AcrescimoResolvido {
  let resto = texto.replace(/^\+\s*/, '').trim()
  const pendencias: Pendencia[] = []
  const primeira = resto.split(/\s+/)[0] ?? ''
  const chave = normalizarTexto(primeira)
  const tipoAcrescimo = TIPOS_ACRESCIMO.find((t) => chave.length >= 3 && t.startsWith(chave)) ?? null
  if (!tipoAcrescimo) pendencias.push('tipo_acrescimo')
  else resto = resto.slice(primeira.length).trim()

  let valor: number | undefined
  const mVal = resto.match(RE_VALOR_FIM)
  if (mVal?.[1]) {
    valor = paraNumero(mVal[1])
    resto = resto.slice(0, resto.length - mVal[0].length).trim()
  } else {
    pendencias.push('valor')
  }
  return { tipo: 'acrescimo', tipoAcrescimo, descricao: resto, valor, pendencias }
}

export function resolverLinha(texto: string, catalogo: MaterialCatalogo[], opcoes: OpcoesResolucao = {}): LinhaResolvida {
  // O legado datilografava "03PLACAS": digitos iniciais colados em letras ganham um espaco.
  const aparado = texto.trim().replace(RE_QTD_COLADA, '$1 ')
  if (aparado.startsWith('+')) return resolverAcrescimo(aparado)

  let totalDigitado: number | undefined
  const semTotal = aparado.replace(RE_TOTAL_LEGADO, (_, v: string) => {
    totalDigitado = paraNumero(v)
    return ''
  })

  let unidadeSufixo: UnidadeCobranca | undefined
  const semSufixo = semTotal.replace(RE_SUFIXO, (_, s: string) => {
    unidadeSufixo = SUFIXO_UNIDADE[s.toLowerCase()]
    return ''
  })

  const linha = interpretarLinha(semSufixo)
  const busca = opcoes.materialEscolhido !== undefined
    ? { escolhido: opcoes.materialEscolhido, candidatos: [] }
    : acharMaterial(linha.descricao, catalogo)
  const material = busca.escolhido

  // Regra do legado e da spec: sem material do catalogo o preco e por unidade; m2 so vem do
  // material, do sufixo ou da escolha do operador. A sugestao do parser nao e usada.
  let unidade: UnidadeCobranca
  let origemUnidade: OrigemUnidade
  if (opcoes.unidadeEscolhida) { unidade = opcoes.unidadeEscolhida; origemUnidade = 'escolhida' }
  else if (unidadeSufixo) { unidade = unidadeSufixo; origemUnidade = 'sufixo' }
  else if (material) { unidade = material.unidadeCobranca; origemUnidade = 'material' }
  else { unidade = 'unidade'; origemUnidade = 'padrao' }

  const valorDoCatalogo = linha.valorUnitario === undefined && material !== null
  const valorUnitario = linha.valorUnitario ?? (material ? Number(material.preco) : undefined)

  const pendencias: Pendencia[] = []
  if (!(linha.quantidade > 0) || linha.quantidade > 9999) pendencias.push('quantidade')
  const temMedida = linha.altura !== undefined && linha.largura !== undefined && linha.altura > 0 && linha.largura > 0
  if (unidade !== 'unidade' && !temMedida) pendencias.push('dimensao')
  if (valorUnitario === undefined) pendencias.push('valor')

  return {
    tipo: 'item',
    quantidade: linha.quantidade,
    descricao: linha.descricao,
    material,
    candidatos: busca.candidatos,
    altura: linha.altura,
    largura: linha.largura,
    unidade,
    origemUnidade,
    valorUnitario,
    valorDoCatalogo,
    totalDigitado,
    pendencias,
  }
}

function metros(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

const SUFIXO_LEGIVEL: Record<UnidadeCobranca, string> = { unidade: '/un', m2: '/m²', metro_linear: '/m linear' }

export interface DescricaoLinha {
  texto: string
  /** Total formatado, ou null quando ainda nao da para calcular. */
  total: string | null
  /** Quando a linha trouxe "CD <total>": bate ou nao com qtd x unitario. */
  conferencia: 'ok' | 'diverge' | null
}

/** "qtd 12 · ACM 3 mm · 0,61 × 0,40 m · R$ 61,00/un" e o total, como no artboard. */
export function descreverLinha(r: LinhaResolvida): DescricaoLinha {
  if (r.tipo === 'acrescimo') {
    const partes = ['Acréscimo', r.tipoAcrescimo ?? 'tipo?']
    if (r.descricao) partes.push(r.descricao)
    const total = r.valor !== undefined ? formatarMoeda(dinheiro(r.valor)) : null
    return { texto: partes.join(' · '), total, conferencia: null }
  }

  const partes = [`qtd ${r.quantidade}`, r.material?.nome ?? r.descricao]
  if (r.altura !== undefined && r.largura !== undefined) partes.push(`${metros(r.altura)} × ${metros(r.largura)} m`)
  if (r.valorUnitario !== undefined) partes.push(`${formatarMoeda(dinheiro(r.valorUnitario))}${SUFIXO_LEGIVEL[r.unidade]}`)

  let total: string | null = null
  let conferencia: DescricaoLinha['conferencia'] = null
  if (r.pendencias.length === 0 && r.valorUnitario !== undefined) {
    try {
      const calc = calcularItem({
        unidade: r.unidade, quantidade: r.quantidade, valorUnitario: r.valorUnitario, altura: r.altura, largura: r.largura,
      })
      total = formatarMoeda(calc.total)
      if (r.totalDigitado !== undefined) conferencia = calc.total.equals(dinheiro(r.totalDigitado)) ? 'ok' : 'diverge'
    } catch {
      total = null
    }
  }
  return { texto: partes.join(' · '), total, conferencia }
}

/** "61x40" ou "0,61 x 0,40" digitado no campo de medida. */
export function lerMedida(texto: string): { altura: number; largura: number } | null {
  const m = texto.match(/^\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*[xX×]\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*$/)
  if (!m?.[1] || !m[2]) return null
  return { altura: normalizarDimensao(m[1]), largura: normalizarDimensao(m[2]) }
}

export function proximaUnidade(atual: UnidadeCobranca): UnidadeCobranca {
  return atual === 'unidade' ? 'm2' : atual === 'm2' ? 'metro_linear' : 'unidade'
}
