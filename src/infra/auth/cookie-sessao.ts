import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE_SESSAO } from './constantes'
import { criarSessao, encerrarSessao, validarSessao, DURACAO_SESSAO_SEGUNDOS, type UsuarioSessao } from './sessao'

/** Chamar apenas em Server Action ou Route Handler: cookies().set nao funciona durante render. */
export async function abrirSessaoNoCookie(usuarioId: string): Promise<void> {
  const { id } = await criarSessao(usuarioId)
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  })
}

export async function lerSessaoDoCookie(): Promise<UsuarioSessao | null> {
  const jar = await cookies()
  return validarSessao(jar.get(COOKIE_SESSAO)?.value)
}

/** Apaga a linha no banco e o cookie. Chamar apenas em Server Action ou Route Handler. */
export async function fecharSessaoDoCookie(): Promise<void> {
  const jar = await cookies()
  await encerrarSessao(jar.get(COOKIE_SESSAO)?.value)
  jar.delete(COOKIE_SESSAO)
}
