'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { chaveValida } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { registrarSaida, estornarLancamento, type DadosSaida } from '@/infra/caixa/livro'

export type RespostaSimples = { ok: true } | { ok: false; erro: string }

async function executar(chave: string, corpo: (ctx: { empresaId: string; usuarioId: string; chave: string }) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    await corpo({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave })
    revalidatePath('/financeiro')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function registrarSaidaAction(chave: string, dados: DadosSaida): Promise<RespostaSimples> {
  return executar(chave, (ctx) => registrarSaida(ctx, dados))
}
export async function estornarLancamentoAction(chave: string, lancamentoId: string, motivo: string): Promise<RespostaSimples> {
  return executar(chave, (ctx) => estornarLancamento(ctx, lancamentoId, motivo))
}
