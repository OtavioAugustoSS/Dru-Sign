import type { Decimal } from '../precificacao/dinheiro'
import type { UnidadeCobranca } from '../precificacao/tipos'
import type { EstadoProducao } from './estados'

/** Textos herdados do impresso do legado (OBS8 e rodape): o cliente da loja ja os reconhece. */
export const TEXTOS_IMPRESSO = {
  garantia: 'Sempre guarde esse comprovante como sua garantia de entrega!',
  agradecimento: 'Obrigado pela preferência',
  orcamentoValidade: 'Orçamento sem compromisso. Preços válidos por 15 dias.',
} as const

export interface DadosEmpresaImpresso {
  nomeFantasia: string
  razaoSocial: string
  /** Entram na Fase 5; o layout reserva o espaco e omite o que for null. */
  cnpj?: string | null
  endereco?: string | null
  cidadeUf?: string | null
  telefones?: string[]
}

export interface ItemImpresso {
  quantidade: number
  descricao: string
  unidade: UnidadeCobranca
  altura: number | null
  largura: number | null
  valorUnitario: Decimal
  total: Decimal
}

export interface AcrescimoImpresso {
  descricao: string
  valor: Decimal
}

export interface OrdemImpressa {
  numero: number
  estadoProducao: EstadoProducao
  abertaEm: Date
  prometidaPara: Date | null
  responsavel: string
  cliente: {
    nome: string
    apelido: string | null
    telefone: string | null
    documento: string | null
    /** Ja montado em uma linha; null quando o cadastro nao tinha endereco nenhum. */
    endereco: string | null
  } | null
  itens: ItemImpresso[]
  acrescimos: AcrescimoImpresso[]
  subtotalItens: Decimal
  precoCalculado: Decimal
  precoFinal: Decimal
  ajuste: Decimal
  motivoAjuste: string | null
  observacoes: string | null
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

export function formatarDimensao(altura: number | null, largura: number | null): string {
  if (altura === null || largura === null) return '—'
  return `${fmt(altura)} × ${fmt(largura)} m`
}

/** 'área · 2,88 m²' | 'por unidade' | 'metro linear · perímetro 2,42 m' — igual ao artboard. */
export function descreverCobranca(item: ItemImpresso): string {
  if (item.unidade === 'unidade' || item.altura === null || item.largura === null) return 'por unidade'
  if (item.unidade === 'm2') return `área · ${fmt(item.altura * item.largura * item.quantidade)} m²`
  return `metro linear · perímetro ${fmt(2 * (item.altura + item.largura))} m`
}

export function tituloDocumento(estado: EstadoProducao): string {
  return estado === 'orcamento' ? 'Orçamento' : 'Ordem de Serviço'
}

/**
 * O endereco do cliente em uma linha: "Rua X, 120, Centro · Unaí/MG · 38610-000".
 *
 * Uma linha, e nao um <dt>/<dd> por campo: a folha ja carrega cliente, telefone,
 * documento, itens, valores e assinatura em A4, e endereco em cinco linhas
 * empurraria o resto para a segunda pagina.
 *
 * Campo vazio some junto com o separador dele -- endereco pela metade nao pode
 * sair da impressora com virgula solta ou barra sem UF. A base veio do legado
 * com cadastro incompleto: ha cliente so com cidade, e ha cliente com nada.
 */
export function montarEndereco(c: {
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}): string | null {
  const rua = [c.endereco, c.bairro].map((p) => p?.trim()).filter(Boolean).join(', ')
  const cidade = c.cidade?.trim()
  const uf = c.uf?.trim()
  const local = cidade && uf ? `${cidade}/${uf}` : (cidade ?? uf ?? '')
  const partes = [rua, local, c.cep?.trim()].filter((p): p is string => !!p && p !== '')
  return partes.length > 0 ? partes.join(' · ') : null
}
