import { dinheiro, arredondarCentavos, Decimal } from '../precificacao/dinheiro'
import { interpretarMoeda, formatarMoeda } from '../precificacao/moeda'
import { ErroDeValidacao } from '../precificacao/erros'
import type { ValorNumerico } from '../precificacao/tipos'
import { calcularEstadoPagamento, type EstadoPagamento, type EstadoProducao } from '../ordem/estados'
import { lerDataCalendario } from '../ordem/datas'
import { ehFormaPagamento, type FormaPagamento } from './formas'

export interface ResumoPagamento {
  totalRecebido: Decimal
  /** Quanto falta; nunca negativo. */
  saldo: Decimal
  estado: EstadoPagamento
}

export const ROTULO_PAGAMENTO: Record<EstadoPagamento, string> = { nao_pago: 'Não pago', parcial: 'Parcial', pago: 'Pago' }

/** O eixo de pagamento e derivado daqui e so daqui (spec, secao 6). */
export function resumirPagamento(precoFinal: ValorNumerico, recebimentos: ValorNumerico[]): ResumoPagamento {
  const total = dinheiro(precoFinal)
  const totalRecebido = recebimentos.reduce((s, r) => s.plus(dinheiro(r)), dinheiro(0))
  const saldo = Decimal.max(total.minus(totalRecebido), 0)
  return {
    totalRecebido: arredondarCentavos(totalRecebido),
    saldo: arredondarCentavos(saldo),
    estado: calcularEstadoPagamento(precoFinal, recebimentos),
  }
}

export interface DadosRecebimentoDigitado {
  /** Como a Odete digita: "150", "150,00", "1.200,00". */
  valor: string
  forma: string
  /** 'AAAA-MM-DD' do <input type="date">. */
  data: string
}

export interface SituacaoDaOrdem {
  precoFinal: ValorNumerico
  totalRecebido: ValorNumerico
  estadoProducao: EstadoProducao
}

export interface RecebimentoValidado {
  valor: Decimal
  forma: FormaPagamento
  data: Date
}

const TOLERANCIA = dinheiro('0.01')

export function validarRecebimento(dados: DadosRecebimentoDigitado, s: SituacaoDaOrdem): RecebimentoValidado {
  if (s.estadoProducao === 'orcamento') throw new ErroDeValidacao('Aprove o orçamento antes de receber.')
  if (s.estadoProducao === 'cancelada') throw new ErroDeValidacao('Ordem cancelada não recebe pagamento.')
  const preco = dinheiro(s.precoFinal)
  if (preco.lte(0)) throw new ErroDeValidacao('Esta ordem não tem valor a receber.')
  const saldo = preco.minus(dinheiro(s.totalRecebido))
  if (saldo.lte(0)) throw new ErroDeValidacao('Esta ordem já está paga.')

  const valor = interpretarMoeda(dados.valor)
  if (valor === null) throw new ErroDeValidacao('Informe o valor recebido.')
  if (valor.lte(0)) throw new ErroDeValidacao('O valor precisa ser maior que zero.')
  if (valor.gt(saldo.plus(TOLERANCIA))) throw new ErroDeValidacao(`O valor é maior que o saldo a receber (${formatarMoeda(saldo)}).`)
  if (!ehFormaPagamento(dados.forma)) throw new ErroDeValidacao('Escolha a forma de pagamento.')
  const data = lerDataCalendario(dados.data)
  if (!data) throw new ErroDeValidacao('Data do recebimento inválida.')
  return { valor: arredondarCentavos(valor), forma: dados.forma, data }
}
