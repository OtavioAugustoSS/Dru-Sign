import { dinheiro, type Decimal } from '@/domain/precificacao/dinheiro'
import { formatarMoeda } from '@/domain/precificacao/moeda'

/**
 * R$ 1.234,56, venha o valor como Decimal do dominio ou como a string que o
 * Prisma devolve.
 *
 * Existe porque seis telas declaravam o mesmo atalho `const R$ = (v) =>
 * formatarMoeda(dinheiro(v))`, e uma setima tinha uma implementacao PROPRIA por
 * expressao regular que nao arredondava e inseria o separador de milhar depois
 * da virgula decimal. Dinheiro so pode ser formatado de um jeito.
 */
export function valorEmReais(valor: string | Decimal): string {
  return formatarMoeda(typeof valor === 'string' ? dinheiro(valor) : valor)
}

/**
 * O valor formatado, e so isso.
 *
 * NAO embrulha em `<span className="numero">` de proposito: `numero` alinha a
 * direita, e `text-align` num elemento inline nao alinha nada. A classe pertence
 * ao `<td>` ou a `<div>` que contem o valor, como ja era. Trocar isso por um
 * span perderia silenciosamente o alinhamento de todas as colunas de dinheiro.
 */
export function Dinheiro({ valor }: { valor: string | Decimal }) {
  return <>{valorEmReais(valor)}</>
}
