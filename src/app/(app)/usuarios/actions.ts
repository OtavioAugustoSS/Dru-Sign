'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { criarUsuario, alterarUsuario, alterarAtivoUsuario, trocarSenha } from '@/infra/usuarios/repositorio'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

async function executar(corpo: (empresaId: string, usuarioId: string) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await corpo(usuario.empresaId, usuario.id)
    revalidatePath('/usuarios')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function criarUsuarioAction(dados: { nome: string; login: string; papel: string; senha: string }): Promise<RespostaSimples> {
  return executar((empresaId) => criarUsuario(empresaId, dados))
}
export async function alterarUsuarioAction(id: string, dados: { nome: string; papel: string }): Promise<RespostaSimples> {
  return executar((empresaId) => alterarUsuario(empresaId, id, dados))
}
export async function alterarAtivoUsuarioAction(id: string, ativo: boolean): Promise<RespostaSimples> {
  return executar((empresaId, usuarioId) => alterarAtivoUsuario(empresaId, id, ativo, usuarioId))
}
export async function trocarSenhaAction(id: string, senha: string): Promise<RespostaSimples> {
  return executar((empresaId) => trocarSenha(empresaId, id, senha))
}
