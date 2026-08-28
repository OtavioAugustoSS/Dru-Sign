/**
 * Aceita so caminho interno: comeca com uma barra e nao com duas nem com barra invertida
 * (navegadores tratam "/\evil.com" como "//evil.com"). Evita open redirect no ?proximo=.
 */
export function destinoSeguro(proximo: unknown, padrao = '/'): string {
  if (
    typeof proximo === 'string' &&
    proximo.startsWith('/') &&
    !proximo.startsWith('//') &&
    !proximo.startsWith('/\\')
  ) {
    return proximo
  }
  return padrao
}
