import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { executarUmaVez, type Contexto, type Tx } from '@/infra/mutacoes/idempotencia'
import { ConflitoVersao, OrdemNaoEditavel } from '@/infra/ordens/erros'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { transicionar, type EstadoPagamento, type EstadoProducao } from '@/domain/ordem/estados'
import { resumirPagamento, validarRecebimento, type ResumoPagamento } from '@/domain/caixa/pagamento'
import { historicoDeRecebimento } from '@/domain/caixa/lancamento'
import { totalRecebidoPorOrdem } from './resumo'
import type { Prisma } from '@/generated/prisma/client'

export interface DadosRecebimento {
  /** Como digitado: "150", "150,00". */
  valor: string
  forma: string
  /** 'AAAA-MM-DD'. */
  data: string
  observacao?: string
  /** "Concluir e receber": a transicao aberta -> concluida entra na mesma transacao. */
  concluir: boolean
}

/** JSON puro: e o que a action devolve e o que a tabela mutacao guarda. */
export interface ResultadoDinheiro {
  versao: number
  estadoProducao: EstadoProducao
  estadoPagamento: EstadoPagamento
  totalRecebido: string
  saldo: string
}

async function carregarComTrava(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await tx.ordemServico.findFirst({
    where: { id: ordemId, empresaId: ctx.empresaId },
    select: { id: true, numero: true, estadoProducao: true, versao: true, precoFinal: true, clienteNome: true, clienteApelido: true },
  })
  if (!ordem) throw new Error('ordem nao encontrada')
  if (ordem.versao !== versao) throw new ConflitoVersao()
  return ordem
}

async function resumo(tx: Tx, empresaId: string, ordemId: string, precoFinal: Prisma.Decimal): Promise<ResumoPagamento> {
  const total = (await totalRecebidoPorOrdem(tx, empresaId, [ordemId])).get(ordemId) ?? '0.00'
  return resumirPagamento(paraDominio(precoFinal).toFixed(), [total])
}

/** A trava: updateMany pela versao lida; 0 linhas = alguem gravou antes -> rollback de tudo que veio antes. */
async function gravarVersao(tx: Tx, ctx: Contexto, ordemId: string, versao: number, dados: Prisma.OrdemServicoUpdateManyMutationInput = {}) {
  const { count } = await tx.ordemServico.updateMany({
    where: { id: ordemId, empresaId: ctx.empresaId, versao },
    data: { ...dados, versao: { increment: 1 } },
  })
  if (count === 0) throw new ConflitoVersao()
}

function resultado(versao: number, estadoProducao: EstadoProducao, r: ResumoPagamento): ResultadoDinheiro {
  return { versao: versao + 1, estadoProducao, estadoPagamento: r.estado, totalRecebido: r.totalRecebido.toFixed(2), saldo: r.saldo.toFixed(2) }
}

const CONCLUIDA = (ctx: Contexto) => ({ estadoProducao: 'concluida' as const, concluidaEm: new Date(), concluidaPorId: ctx.usuarioId })

/**
 * Registrar o recebimento e lancar no caixa nunca sao operacoes separadas (spec, secao 6); com
 * `concluir`, a transicao aberta -> concluida entra na mesma transacao (spec, secao 9). Ou tudo, ou nada.
 */
export async function registrarRecebimento(ctx: Contexto, ordemId: string, versao: number, dados: DadosRecebimento): Promise<ResultadoDinheiro> {
  return executarUmaVez(ctx, 'recebimento.registrar', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    let estado = ordem.estadoProducao
    if (dados.concluir) {
      if (estado !== 'aberta') throw new OrdemNaoEditavel(estado)
      estado = transicionar(estado, 'concluida')
    }
    const antes = await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal)
    const r = validarRecebimento(
      { valor: dados.valor, forma: dados.forma, data: dados.data },
      { precoFinal: paraDominio(ordem.precoFinal).toFixed(), totalRecebido: antes.totalRecebido.toFixed(), estadoProducao: estado },
    )
    const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: ctx.empresaId }, select: { contaRecebimentoId: true } })
    if (!empresa.contaRecebimentoId) throw new ErroDeValidacao('defina no plano de contas a conta que recebe as vendas')

    const lancamento = await tx.lancamentoCaixa.create({
      data: {
        empresaId: ctx.empresaId, data: r.data, tipo: 'entrada', valor: paraBanco(r.valor), contaId: empresa.contaRecebimentoId,
        historico: historicoDeRecebimento(ordem.numero, ordem.clienteNome, ordem.clienteApelido, r.forma),
        ordemId: ordem.id, usuarioId: ctx.usuarioId,
      },
      select: { id: true },
    })
    await tx.recebimento.create({
      data: {
        empresaId: ctx.empresaId, ordemId: ordem.id, data: r.data, valor: paraBanco(r.valor), forma: r.forma,
        observacao: dados.observacao?.trim().slice(0, 160) || null, usuarioId: ctx.usuarioId, lancamentoId: lancamento.id,
      },
    })
    await gravarVersao(tx, ctx, ordem.id, versao, dados.concluir ? CONCLUIDA(ctx) : {})
    return resultado(versao, estado, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}

/** "Servico finalizado": a unica acao da producao. Nao toca em dinheiro. */
export async function concluirOrdem(ctx: Contexto, ordemId: string, versao: number): Promise<ResultadoDinheiro> {
  return executarUmaVez(ctx, 'ordem.concluir', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    if (ordem.estadoProducao !== 'aberta') throw new OrdemNaoEditavel(ordem.estadoProducao)
    const estado = transicionar(ordem.estadoProducao, 'concluida')
    await gravarVersao(tx, ctx, ordem.id, versao, CONCLUIDA(ctx))
    return resultado(versao, estado, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}

/** Erro de dinheiro se estorna, nunca se edita nem se apaga: recebimento e lancamento marcados juntos. */
export async function estornarRecebimento(ctx: Contexto, ordemId: string, versao: number, recebimentoId: string, motivo: string): Promise<ResultadoDinheiro> {
  const motivoLimpo = motivo.trim().slice(0, 160)
  if (motivoLimpo === '') throw new ErroDeValidacao('o motivo do estorno é obrigatório')
  return executarUmaVez(ctx, 'recebimento.estornar', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    const rec = await tx.recebimento.findFirst({ where: { id: recebimentoId, ordemId: ordem.id, empresaId: ctx.empresaId }, select: { id: true, lancamentoId: true, estornadoEm: true } })
    if (!rec) throw new ErroDeValidacao('recebimento não encontrado')
    if (rec.estornadoEm) throw new ErroDeValidacao('recebimento já estornado')
    const marca = { estornadoEm: new Date(), estornadoPorId: ctx.usuarioId, motivoEstorno: motivoLimpo }
    await tx.recebimento.update({ where: { id: rec.id }, data: marca })
    await tx.lancamentoCaixa.update({ where: { id: rec.lancamentoId }, data: marca })
    await gravarVersao(tx, ctx, ordem.id, versao)
    return resultado(versao, ordem.estadoProducao, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}
