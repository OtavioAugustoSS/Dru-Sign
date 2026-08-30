import { arredondarCentavos, type Decimal } from '../precificacao/dinheiro'
import { interpretarMoeda } from '../precificacao/moeda'
import { ErroDeValidacao } from '../precificacao/erros'
import { lerDataCalendario } from '../ordem/datas'
import { ROTULO_FORMA, type FormaPagamento } from './formas'

export type TipoConta = 'receita' | 'despesa'
export type TipoLancamento = 'entrada' | 'saida'

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = { receita: 'Receita', despesa: 'Despesa' }
export const ROTULO_TIPO_LANCAMENTO: Record<TipoLancamento, string> = { entrada: 'Entrada', saida: 'Saída' }

export interface DadosSaidaDigitada {
  valor: string
  data: string
  historico: string
  /** Vazio quando nao parcelado. A parcela fica na saida, nao na venda (spec, secao 4). */
  parcela: string
  totalParcelas: string
}

export interface SaidaValidada {
  valor: Decimal
  data: Date
  historico: string
  parcela: number | null
  totalParcelas: number | null
}

function inteiroOuNull(texto: string, rotulo: string): number | null {
  const t = texto.trim()
  if (t === '') return null
  if (!/^\d{1,2}$/.test(t) || Number(t) === 0) throw new ErroDeValidacao(`${rotulo} inválida.`)
  return Number(t)
}

export function validarSaida(dados: DadosSaidaDigitada, conta: { tipo: TipoConta; ativa: boolean }): SaidaValidada {
  if (conta.tipo !== 'despesa') throw new ErroDeValidacao('Uma saída precisa de uma conta de despesa.')
  if (!conta.ativa) throw new ErroDeValidacao('Esta conta está desativada.')
  const valor = interpretarMoeda(dados.valor)
  if (valor === null) throw new ErroDeValidacao('Informe o valor.')
  if (valor.lte(0)) throw new ErroDeValidacao('O valor precisa ser maior que zero.')
  const data = lerDataCalendario(dados.data)
  if (!data) throw new ErroDeValidacao('Data inválida.')
  const historico = dados.historico.trim().replace(/\s+/g, ' ').slice(0, 160)
  if (historico === '') throw new ErroDeValidacao('Descreva o histórico.')
  const parcela = inteiroOuNull(dados.parcela, 'Parcela')
  let totalParcelas = inteiroOuNull(dados.totalParcelas, 'Quantidade de parcelas')
  if (parcela === null && totalParcelas !== null) throw new ErroDeValidacao('Informe a parcela, por exemplo 2 de 3.')
  if (parcela !== null && totalParcelas === null) totalParcelas = 1
  if (parcela !== null && totalParcelas !== null && parcela > totalParcelas) throw new ErroDeValidacao('A parcela não pode ser maior que o total de parcelas.')
  return { valor: arredondarCentavos(valor), data, historico, parcela, totalParcelas }
}

export function formatarNumeroOs(numero: number): string {
  return String(numero).padStart(6, '0')
}

/** O que aparece no livro-caixa: "OS 018461 · FACTU · Pix". */
export function historicoDeRecebimento(numero: number, clienteNome: string | null, clienteApelido: string | null, forma: FormaPagamento): string {
  const quem = clienteApelido || clienteNome || 'Venda de balcão'
  return `OS ${formatarNumeroOs(numero)} · ${quem} · ${ROTULO_FORMA[forma]}`
}

/**
 * Uma linha do livro-caixa, como a tela e o relatorio a leem. Mora no dominio porque e
 * conceito de negocio: a infra so a preenche a partir do banco.
 */
export interface LinhaLivro {
  id: string
  /** ISO da @db.Date (meia-noite UTC): formatar com formatarDataCalendario. */
  data: string
  tipo: TipoLancamento
  valor: string
  contaCodigo: number
  contaNome: string
  historico: string
  ordemId: string | null
  ordemNumero: number | null
  fornecedor: string | null
  parcela: number | null
  totalParcelas: number | null
  usuarioNome: string
  estornadoEm: string | null
  motivoEstorno: string | null
}

