'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/infra/db/prisma'
import { verificarSenha, hashDummy } from '@/infra/auth/senha'
import { abrirSessaoNoCookie, fecharSessaoDoCookie } from '@/infra/auth/cookie-sessao'
import { destinoSeguro } from '@/infra/auth/destino'
import { bloqueadoAte, registrarFalha, registrarSucesso } from '@/infra/auth/tentativas'

export interface EstadoEntrar {
  erro?: string
  login?: string
}

const ERRO_CREDENCIAIS = 'Login ou senha inválidos.'

export async function entrar(_estado: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  const proximo = destinoSeguro(formData.get('proximo'))

  if (login.length === 0 || senha.length === 0) {
    return { erro: 'Informe login e senha.', login }
  }
  if (login.length > 64 || senha.length > 256) {
    return { erro: ERRO_CREDENCIAIS, login }
  }
  if (bloqueadoAte(login) !== null) {
    return { erro: 'Muitas tentativas. Aguarde um minuto e tente de novo.', login }
  }

  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, senhaHash: true, ativo: true },
  })

  // Verifica sempre um hash (o dummy quando o login nao existe): o tempo de resposta nao revela logins.
  const senhaOk = await verificarSenha(usuario?.senhaHash ?? (await hashDummy()), senha)

  if (!usuario || !senhaOk || !usuario.ativo) {
    registrarFalha(login)
    return { erro: ERRO_CREDENCIAIS, login }
  }

  registrarSucesso(login)
  await abrirSessaoNoCookie(usuario.id)
  redirect(proximo) // lanca NEXT_REDIRECT; fica fora de try/catch de proposito
}

export async function sair(): Promise<void> {
  await fecharSessaoDoCookie()
  redirect('/entrar')
}
