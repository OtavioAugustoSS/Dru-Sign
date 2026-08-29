'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { criarConta, alterarAtiva, definirContaRecebimento } from '@/infra/caixa/plano'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

async function executar(corpo: (empresaId: string) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await corpo(usuario.empresaId)
    revalidatePath('/plano-de-contas')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function criarContaAction(dados: { nome: string; tipo: string; grupo: string }): Promise<RespostaSimples> {
  return executar((empresaId) => criarConta(empresaId, dados))
}
export async function alterarAtivaAction(contaId: string, ativa: boolean): Promise<RespostaSimples> {
  return executar((empresaId) => alterarAtiva(empresaId, contaId, ativa))
}
export async function definirContaRecebimentoAction(contaId: string): Promise<RespostaSimples> {
  return executar((empresaId) => definirContaRecebimento(empresaId, contaId))
}
