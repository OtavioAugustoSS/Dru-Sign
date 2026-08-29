import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE_TEMA, DURACAO_TEMA_SEGUNDOS, normalizarTema, type Tema } from './preferencia'

export async function lerTemaDoCookie(): Promise<Tema> {
  const jar = await cookies()
  return normalizarTema(jar.get(COOKIE_TEMA)?.value)
}

/**
 * Chamar apenas em Server Action ou Route Handler: cookies().set nao funciona
 * durante render.
 *
 * Sem `httpOnly` de proposito — e o unico cookie que o navegador precisa ler,
 * e nao carrega nada sobre a pessoa alem de como ela gosta de ver a tela.
 */
export async function gravarTemaNoCookie(tema: Tema): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_TEMA, tema, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_TEMA_SEGUNDOS,
  })
}
