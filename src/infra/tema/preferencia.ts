/**
 * Preferencia de tema: modulo puro, sem Next e sem `server-only`, porque o
 * servidor le no layout e o navegador le no seletor.
 *
 * Sao tres estados, nao dois. "sistema" e o padrao e nao tem atributo proprio:
 * o servidor nao sabe o que o Windows da pessoa esta usando, entao quem resolve
 * e um script no navegador (ver `src/app/layout.tsx`).
 */

export const TEMAS = ['sistema', 'claro', 'escuro'] as const
export type Tema = (typeof TEMAS)[number]

export const TEMA_PADRAO: Tema = 'sistema'
export const COOKIE_TEMA = 'drusign_tema'

/** Um ano: e preferencia de aparencia, nao sessao. Nao expira junto com o login. */
export const DURACAO_TEMA_SEGUNDOS = 60 * 60 * 24 * 365

export const ROTULO_TEMA: Record<Tema, string> = {
  sistema: 'Sistema',
  claro: 'Claro',
  escuro: 'Escuro',
}

/** Cookie vindo do navegador e texto de fora: qualquer coisa fora da lista vira o padrao. */
export function normalizarTema(valor: string | undefined | null): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : TEMA_PADRAO
}

/**
 * O valor de `data-bs-theme` que o Tabler entende, ou `null` quando quem decide
 * e o sistema operacional — nesse caso o servidor nao escreve atributo nenhum.
 */
export function atributoDoTema(tema: Tema): 'light' | 'dark' | null {
  if (tema === 'claro') return 'light'
  if (tema === 'escuro') return 'dark'
  return null
}
