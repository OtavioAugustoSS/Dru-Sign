'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { salvarEmpresa } from '@/infra/empresa/repositorio'
import type { EmpresaTela } from '@/infra/empresa/repositorio'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

export async function salvarEmpresaAction(dados: Record<keyof EmpresaTela, string>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await salvarEmpresa(usuario.empresaId, dados)
    revalidatePath('/empresa')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}
