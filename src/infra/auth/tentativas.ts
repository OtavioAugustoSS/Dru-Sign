/**
 * Limite de tentativas de login por conta: 5 erros seguidos bloqueiam por 1 minuto.
 * Em memoria — vale por instancia do servidor, o que basta para uma loja com 3 usuarios.
 */
const MAXIMO_ERROS = 5
const BLOQUEIO_MS = 60_000

interface Registro {
  erros: number
  bloqueadoAte: number
}

const registros = new Map<string, Registro>()

/** Instante (ms) ate o qual o login esta bloqueado, ou null quando pode tentar. */
export function bloqueadoAte(login: string, agora = Date.now()): number | null {
  const r = registros.get(login)
  if (!r) return null
  if (r.bloqueadoAte > agora) return r.bloqueadoAte
  if (r.bloqueadoAte !== 0) registros.delete(login)
  return null
}

export function registrarFalha(login: string, agora = Date.now()): void {
  const r = registros.get(login) ?? { erros: 0, bloqueadoAte: 0 }
  r.erros += 1
  if (r.erros >= MAXIMO_ERROS) {
    r.bloqueadoAte = agora + BLOQUEIO_MS
    r.erros = 0
  }
  registros.set(login, r)
}

export function registrarSucesso(login: string): void {
  registros.delete(login)
}

/** So para testes. */
export function _limparParaTestes(): void {
  registros.clear()
}
