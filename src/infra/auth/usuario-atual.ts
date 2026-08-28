import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { lerSessaoDoCookie } from './cookie-sessao'
import type { UsuarioSessao } from './sessao'
import type { PapelUsuario } from '@/domain/usuarios/tipos'

/** Memoizado por request: layout, pagina e action no mesmo request fazem uma consulta so. */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => lerSessaoDoCookie())

/** Para paginas e actions protegidas: devolve o usuario ou manda para /entrar. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual()
  if (!usuario) redirect('/entrar')
  return usuario
}

/** Tela de administracao: quem nao tem o papel volta para a fila, sem estado intermediario. */
export async function exigirPapel(papel: PapelUsuario): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario()
  if (usuario.papel !== papel) redirect('/')
  return usuario
}
