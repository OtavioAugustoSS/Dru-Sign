import { dinheiro, Decimal } from './dinheiro'
import { ErroDeValidacao } from './erros'
import type { ValorNumerico } from './tipos'

/**
 * A conta de preco da empresa, uma so para as quatro familias do catalogo.
 *
 * Ao detalhar chapa rigida, bobina, acabamento e produto pronto ficou claro que todas
 * fazem a mesma operacao -- custo mais margem. O que muda entre elas sao os numeros, e e
 * isso que `FamiliaPreco` guarda. Corte por metro linear e perda de bobina NAO entram
 * aqui: sao acrescimo da ordem, que o sistema ja tem.
 */

/** Os passos que a tela deixa escolher. Fora deles nao ha caso de uso conhecido. */
export const PASSOS = [
  { valor: '0.01', rotulo: 'Centavo' },
  { valor: '0.50', rotulo: 'Meio real' },
  { valor: '1.00', rotulo: 'Real inteiro' },
] as const

/** Onde o preco de venda nasceu. A tela mostra isso para o numero ser confiavel. */
export type OrigemPreco = 'familia' | 'travado' | 'sem custo' | 'sem família'

export interface ParametrosFamilia {
  /** 120 = mais 120% sobre o custo. */
  margem: ValorNumerico
  /** 0.01, 0.50 ou 1.00. */
  arredondamento: ValorNumerico
}

export interface EntradaVenda extends ParametrosFamilia {
  custo: ValorNumerico
}

export interface MaterialPrecificavel {
  preco: ValorNumerico
  custo: ValorNumerico | null
  precoTravado: boolean
}

export interface PrecoResolvido {
  valor: Decimal
  origem: OrigemPreco
}

/**
 * Generaliza `arredondarCentavos`: com passo 0,01 devolve exatamente o mesmo resultado,
 * e com 0,50 ou 1,00 fecha o preco no valor "redondo" que a loja prefere anunciar.
 */
export function arredondarPasso(valor: Decimal, passo: Decimal): Decimal {
  if (passo.lte(0)) {
    throw new ErroDeValidacao('O arredondamento precisa ser maior que zero.')
  }
  return valor.dividedBy(passo).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(passo)
}

export function calcularVenda({ custo, margem, arredondamento }: EntradaVenda): Decimal {
  const base = dinheiro(custo)
  if (base.lt(0)) {
    throw new ErroDeValidacao('O custo não pode ser negativo.')
  }
  // Margem negativa passa de proposito: vender abaixo do custo e decisao comercial, e a
  // tela avisa. Impedir aqui seria o sistema discordar da dona da empresa.
  const comMargem = base.times(dinheiro(1).plus(dinheiro(margem).dividedBy(100)))
  return arredondarPasso(comMargem, dinheiro(arredondamento))
}

/**
 * O preco que vale para este material agora, e por que. A ordem de precedencia e o
 * contrato da tela: travado ganha da familia, e a falta de custo ou de familia deixa o
 * preco digitado em paz -- e assim que o sistema funcionava antes de existir familia.
 */
export function precoEfetivo(
  material: MaterialPrecificavel,
  familia: ParametrosFamilia | null,
): PrecoResolvido {
  if (material.precoTravado) {
    return { valor: dinheiro(material.preco), origem: 'travado' }
  }
  if (familia === null) {
    return { valor: dinheiro(material.preco), origem: 'sem família' }
  }
  if (material.custo === null) {
    return { valor: dinheiro(material.preco), origem: 'sem custo' }
  }
  return { valor: calcularVenda({ custo: material.custo, ...familia }), origem: 'familia' }
}
