/**
 * Porcentagem escrita em portugues.
 *
 * O dominio calcula e devolve "75.2", que e a forma canonica de um numero. A
 * tela mostrava esse valor cru, entao a Odete lia "75.2%" na tela que ela abre
 * para julgar o proprio negocio. Em portugues o separador decimal e virgula.
 */
export function emPercentual(valor: string | number): string {
  // `Number('')` e zero, nao NaN: sem esta guarda, campo vazio viraria "0,0%",
  // que e pior do que nao mostrar nada -- e um numero inventado.
  if (typeof valor === 'string' && valor.trim() === '') return '—'
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return '—'
  // Uma casa decimal, que e a precisao que o dominio ja produz.
  return `${n.toFixed(1).replace('.', ',')}%`
}

export function Percentual({ valor }: { valor: string | number }) {
  return <>{emPercentual(valor)}</>
}
