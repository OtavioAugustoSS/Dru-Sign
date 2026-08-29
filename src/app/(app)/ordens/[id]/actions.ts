'use server'

import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { chaveValida, type Contexto } from '@/infra/mutacoes/idempotencia'
import { buscarClientes, type ClienteResumo } from '@/infra/clientes/repositorio'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import * as ordens from '@/infra/ordens/repositorio'
import type { DadosItem, DadosAcrescimo, DadosCabecalho, Totais } from '@/infra/ordens/repositorio'

/** JSON puro: serializado para o cliente. */
export type Resposta =
  | { ok: true; totais: Totais }
  | { ok: false; conflito: true }
  | { ok: false; conflito?: false; erro: string }

async function executar(ordemId: string, chave: string, corpo: (ctx: Contexto) => Promise<Totais>): Promise<Resposta> {
  const usuario = await exigirUsuario()
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    const totais = await corpo({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave })
    // revalidatePath limpa o cache do router (voltar com o botao do navegador ja mostra o estado novo);
    // quem chamou ainda faz router.refresh() na mesma transition, entao a proxima acao so parte
    // depois que a versao nova chegou nos props (ressalva do plano).
    revalidatePath(`/ordens/${ordemId}`)
    return { ok: true, totais }
  } catch (e) {
    if (e instanceof ordens.ConflitoVersao) return { ok: false, conflito: true }
    if (e instanceof ordens.OrdemNaoEditavel) return { ok: false, erro: 'Esta ordem não aceita mais alterações.' }
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e // erro de banco: estoura para o error.tsx, nunca vira resposta normal
  }
}

export async function adicionarItemAction(ordemId: string, versao: number, chave: string, dados: DadosItem): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.adicionarItem(ctx, ordemId, versao, dados))
}
export async function adicionarAcrescimoAction(ordemId: string, versao: number, chave: string, dados: DadosAcrescimo): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.adicionarAcrescimo(ctx, ordemId, versao, dados))
}
export async function removerItemAction(ordemId: string, versao: number, itemId: string, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerItem(ctx, ordemId, versao, itemId))
}
export async function removerAcrescimoAction(ordemId: string, versao: number, acrescimoId: string, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerAcrescimo(ctx, ordemId, versao, acrescimoId))
}
export async function ajustarPrecoAction(ordemId: string, versao: number, chave: string, precoFinal: string, motivo: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.ajustarPreco(ctx, ordemId, versao, precoFinal, motivo))
}
export async function confirmarAjusteAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.confirmarAjuste(ctx, ordemId, versao))
}
export async function removerAjusteAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.removerAjuste(ctx, ordemId, versao))
}
export async function atualizarCabecalhoAction(ordemId: string, versao: number, chave: string, dados: DadosCabecalho): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.atualizarCabecalho(ctx, ordemId, versao, dados))
}
export async function aprovarOrcamentoAction(ordemId: string, versao: number, chave: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.aprovarOrcamento(ctx, ordemId, versao))
}
export async function cancelarOrdemAction(ordemId: string, versao: number, chave: string, motivo: string): Promise<Resposta> {
  return executar(ordemId, chave, (ctx) => ordens.cancelarOrdem(ctx, ordemId, versao, motivo))
}

export async function buscarClientesAction(termo: string): Promise<ClienteResumo[]> {
  const usuario = await exigirUsuario()
  if (termo.trim().length < 2) return []
  return buscarClientes(usuario.empresaId, termo, { limite: 8 })
}
