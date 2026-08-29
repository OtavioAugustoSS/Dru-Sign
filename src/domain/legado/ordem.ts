import { arredondarCentavos } from '../precificacao/dinheiro'
import { interpretarMoeda } from '../precificacao/moeda'
import { ErroDeValidacao } from '../precificacao/erros'

/** O legado comecou em 2012 e o sistema novo entra em 2026: fora disso e lixo de digitacao. */
export const ANO_MINIMO = 2000
export const ANO_MAXIMO = 2027

/** Nome que o cancelamento do legado destruiu, em 3.152 ordens (spec, secao 4). */
const NOME_DESTRUIDO = 'C A N C E L A D O'

/**
 * O que o `lerDbf` entrega: campo N/F ja vem como numero, L como 'T'/'F', o resto como texto.
 * Mesmo contrato de `converterContaLegado`.
 */
export type Valor = string | number | null | undefined
export type LinhaDbf = Record<string, Valor>

const txt = (v: Valor): string => (v === null || v === undefined ? '' : String(v).trim())

/** 'AAAAMMDD' do DBF. Devolve null para vazio, malformado ou data impossivel. */
export function lerDataDbf(texto: string): Date | null {
  const t = texto.trim()
  if (!/^\d{8}$/.test(t)) return null
  const ano = Number(t.slice(0, 4))
  const mes = Number(t.slice(4, 6))
  const dia = Number(t.slice(6))
  if (ano < ANO_MINIMO || ano > ANO_MAXIMO) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null
}

/** OBS8 fica de fora: e o texto fixo de garantia do impresso, igual nas 18.443. */
export function juntarObservacoes(v: LinhaDbf): string {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((n) => txt(v[`OBS${n}`]))
    .filter((l) => l !== '')
    .join('\n')
}

/**
 * Os campos N do DBF vem com ponto decimal ("2528.00"), mas ha texto digitado com virgula
 * ("1.358,81"). `interpretarMoeda` ja resolve os dois: virgula manda, e ponto sozinho e decimal.
 * Ler isso na mao foi exatamente o defeito que o ajuste de preco teve na Fase 3.
 */
function decimal(valor: Valor): string {
  const t = txt(valor)
  if (t === '') return '0.00'
  const negativo = t.startsWith('-')
  const d = interpretarMoeda(negativo ? t.slice(1) : t)
  if (d === null) return '0.00'
  return arredondarCentavos(negativo ? d.negated() : d).toFixed(2)
}

export interface OrdemLegadaConvertida {
  numero: number
  dataEntrada: Date
  dataSaida: Date | null
  /** O bruto do DBF quando a data nao converteu — para conferir sem inventar. */
  dataSaidaTexto: string | null
  /** Saida anterior a entrada: 271 ordens. Entra como esta, marcada. */
  dataSaidaSuspeita: boolean
  codigoClienteLegado: number | null
  clienteNome: string
  nomeDestruido: boolean
  telefone: string
  situacao: string
  /** OBS1..OBS7 como vieram. Nunca estruturado (spec, secao 10). */
  texto: string
  valorProdutos: string
  valorServicos: string
  maoDeObra: string
  deslocamento: string
  desconto: string
  total: string
  forma: string
  responsavel: string
  usuario: string
}

export function converterOrdemLegado(v: LinhaDbf): OrdemLegadaConvertida {
  const numero = Number(txt(v.NUMERO))
  if (!Number.isInteger(numero) || numero <= 0) throw new ErroDeValidacao(`ordem sem numero: ${JSON.stringify(v.NUMERO)}`)
  const dataEntrada = lerDataDbf(txt(v.DATAENT))
  if (!dataEntrada) throw new ErroDeValidacao(`ordem ${numero} sem data de entrada valida: ${JSON.stringify(v.DATAENT)}`)

  const brutoSaida = txt(v.DATASAI)
  const dataSaida = lerDataDbf(brutoSaida)
  const codigo = Number(txt(v.CODCLI))
  const clienteNome = txt(v.CADASTRO)
  const texto = (s: Valor, tamanho: number) => txt(s).slice(0, tamanho)

  return {
    numero,
    dataEntrada,
    dataSaida,
    dataSaidaTexto: dataSaida === null && brutoSaida !== '' ? brutoSaida : null,
    dataSaidaSuspeita: dataSaida !== null && dataSaida.getTime() < dataEntrada.getTime(),
    codigoClienteLegado: Number.isInteger(codigo) && codigo > 0 ? codigo : null,
    clienteNome,
    nomeDestruido: clienteNome.toUpperCase() === NOME_DESTRUIDO,
    telefone: texto(v.TELEFONE, 20),
    situacao: texto(v.SITUACAO, 40),
    texto: juntarObservacoes(v),
    valorProdutos: decimal(v.VLRPROD),
    valorServicos: decimal(v.VLRSERV),
    maoDeObra: decimal(v.MAO_OBRA),
    deslocamento: decimal(v.DESLOCA),
    desconto: decimal(v.DESCONTO),
    total: decimal(v.TOTAL),
    forma: texto(v.FORMA, 20),
    responsavel: texto(v.RESPONSA, 40),
    usuario: texto(v.USUARIO, 20),
  }
}
