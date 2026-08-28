import { dinheiro, arredondarCentavos, type Decimal } from './dinheiro'

/**
 * Le o que o operador digita: "281", "281,00", "1.234,56", "R$ 1.234,56", "1234.56".
 * Virgula e separador decimal quando existe; ponto e milhar quando ha virgula, decimal quando nao ha.
 * Negativo, vazio ou ambiguo devolve null.
 */
export function interpretarMoeda(texto: string): Decimal | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (limpo === '' || !/^[0-9.,]+$/.test(limpo)) return null

  const virgulas = (limpo.match(/,/g) ?? []).length
  if (virgulas > 1) return null

  let normalizado: string
  if (virgulas === 1) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else {
    const pontos = (limpo.match(/\./g) ?? []).length
    normalizado = pontos > 1 ? limpo.replace(/\./g, '') : limpo
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null
  return dinheiro(normalizado)
}

/** R$ 1.234,56 — a partir do Decimal, sem passar por ponto flutuante. */
export function formatarMoeda(valor: Decimal): string {
  const texto = arredondarCentavos(valor).toFixed(2)
  const [inteiro = '0', centavos = '00'] = texto.split('.')
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${comMilhar},${centavos}`
}
