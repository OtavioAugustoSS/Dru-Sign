'use server'

import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { chaveValida } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { concluirOrdem } from '@/infra/caixa/recebimentos'
import * as ordens from '@/infra/ordens/repositorio'
import type { RespostaDinheiro } from '@/app/(app)/ordens/[id]/actions'

/** "Servico finalizado" e a unica acao da producao, e nao toca em dinheiro (spec, secao 3). */
export async function finalizarServicoAction(ordemId: string, versao: number, chave: string): Promise<RespostaDinheiro> {
  const usuario = await exigirUsuario()
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    const resultado = await concluirOrdem({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave }, ordemId, versao)
    revalidatePath('/')
    revalidatePath('/producao')
    revalidatePath(`/ordens/${ordemId}`)
    return { ok: true, resultado }
  } catch (e) {
    if (e instanceof ordens.ConflitoVersao) return { ok: false, conflito: true }
    if (e instanceof ordens.OrdemNaoEditavel) return { ok: false, erro: 'Esta ordem não está mais em produção.' }
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}
