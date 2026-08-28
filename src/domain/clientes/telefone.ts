export interface TelefoneNormalizado {
  /** So digitos, discavel: 11 para celular (DDD + 9 + 8), 10 para fixo (DDD + 8). null quando nao da para discar. */
  normalizado: string | null
  /** true quando o sistema completou o que faltava: o nono digito, ou o DDD de Unai. */
  inferido: boolean
}

/** A empresa e de Unai/MG: numero sem DDD e daqui. */
const DDD_PADRAO = '38'

const NAO_DISCAVEL: TelefoneNormalizado = { normalizado: null, inferido: false }

/**
 * Regra da spec (secao 10), medida na base: a mascara do legado e (99)9999-9999 e nao cabe o
 * nono digito. DDD + 8 digitos comecando em 6/7/8/9 e celular e ganha o 9; 2/3/4/5 e fixo.
 */
export function normalizarTelefone(original: string): TelefoneNormalizado {
  const digitos = original.replace(/\D/g, '')
  if (digitos.length === 8) return completar(DDD_PADRAO + digitos, true)
  if (digitos.length === 10) return completar(digitos, false)
  if (digitos.length === 11) {
    return dddValido(digitos) && digitos[2] === '9' && digitos[3] !== '0'
      ? { normalizado: digitos, inferido: false }
      : NAO_DISCAVEL
  }
  return NAO_DISCAVEL
}

function dddValido(digitos: string): boolean {
  return /^[1-9][0-9]/.test(digitos)
}

function completar(dez: string, dddInferido: boolean): TelefoneNormalizado {
  if (!dddValido(dez)) return NAO_DISCAVEL
  const ddd = dez.slice(0, 2)
  const numero = dez.slice(2)
  const primeiro = numero[0] ?? ''
  if (primeiro !== '' && '6789'.includes(primeiro)) {
    return { normalizado: `${ddd}9${numero}`, inferido: true }
  }
  if (primeiro !== '' && '2345'.includes(primeiro)) {
    return { normalizado: dez, inferido: dddInferido }
  }
  return NAO_DISCAVEL
}

/** (38) 99968-1168 para celular, (38) 3676-6222 para fixo. Devolve a entrada quando nao reconhece. */
export function formatarTelefone(normalizado: string): string {
  if (normalizado.length === 11) {
    return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 7)}-${normalizado.slice(7)}`
  }
  if (normalizado.length === 10) {
    return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 6)}-${normalizado.slice(6)}`
  }
  return normalizado
}
