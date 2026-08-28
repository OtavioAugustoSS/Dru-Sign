export type TipoDocumento = 'cpf' | 'cnpj'

export interface DocumentoNormalizado {
  digitos: string
  tipo: TipoDocumento
}

/**
 * So digitos: 11 e CPF, 14 e CNPJ, o resto nao e documento. Sem digito verificador de
 * proposito: o legado tem a Prefeitura de Unai em 18 cadastros com o mesmo CNPJ, e isso e
 * a operacao real (cada secretaria tem empenho separado). Agrupar por documento no relatorio
 * e o que faz ela aparecer como o maior cliente da empresa.
 */
export function normalizarDocumento(original: string): DocumentoNormalizado | null {
  const digitos = original.replace(/\D/g, '')
  if (digitos.length === 11) return { digitos, tipo: 'cpf' }
  if (digitos.length === 14) return { digitos, tipo: 'cnpj' }
  return null
}

export function formatarDocumento(digitos: string): string {
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
  }
  if (digitos.length === 14) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`
  }
  return digitos
}
