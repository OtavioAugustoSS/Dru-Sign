import { calcularItem } from './formulas'
import { dinheiro, arredondarCentavos, type Decimal } from './dinheiro'
import type { ItemCobranca, ValorNumerico } from './tipos'
import { ErroDeValidacao } from './erros'

export interface Acrescimo {
  tipo: string
  descricao: string
  valor: ValorNumerico
}

export interface ComposicaoOrdem {
  subtotalItens: Decimal
  subtotalAcrescimos: Decimal
  precoCalculado: Decimal
  precoFinal: Decimal
  ajuste: Decimal
  temAjuste: boolean
}

export function comporOrdem(
  itens: ItemCobranca[],
  acrescimos: Acrescimo[],
  precoFinalManual?: ValorNumerico,
): ComposicaoOrdem {
  const subtotalItens = arredondarCentavos(
    itens.reduce((soma, i) => soma.plus(calcularItem(i).total), dinheiro(0)),
  )
  const subtotalAcrescimos = arredondarCentavos(
    acrescimos.reduce((soma, a) => soma.plus(dinheiro(a.valor)), dinheiro(0)),
  )
  const precoCalculado = arredondarCentavos(subtotalItens.plus(subtotalAcrescimos))

  if (precoFinalManual === undefined) {
    return {
      subtotalItens, subtotalAcrescimos, precoCalculado,
      precoFinal: precoCalculado, ajuste: dinheiro(0), temAjuste: false,
    }
  }

  if (dinheiro(precoFinalManual).lt(0)) {
    throw new ErroDeValidacao('preco final nao pode ser negativo')
  }

  const precoFinal = arredondarCentavos(dinheiro(precoFinalManual))
  const ajuste = arredondarCentavos(precoFinal.minus(precoCalculado))

  return {
    subtotalItens, subtotalAcrescimos, precoCalculado,
    precoFinal, ajuste, temAjuste: !ajuste.isZero(),
  }
}
