import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/infra/db/prisma'

export type Tx = Prisma.TransactionClient

export interface Contexto {
  empresaId: string
  usuarioId: string
  /** crypto.randomUUID() gerado no cliente, um por tentativa. */
  chave: string
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function chaveValida(chave: string): boolean {
  return RE_UUID.test(chave)
}

function violacaoUnica(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * Registra a chave NO INICIO da transacao (o insert na unique toma o lock antes do trabalho),
 * executa o corpo com o mesmo tx e grava a resposta no fim. Se a chave ja existe, a primeira
 * execucao commitou: devolve a resposta gravada sem executar de novo. Erro no corpo desfaz tudo,
 * inclusive a chave — o retry legitimo funciona.
 */
/** R precisa ser JSON puro (strings, numeros, objetos simples): e serializado e gravado como esta. */
export async function executarUmaVez<R extends object>(
  ctx: Contexto,
  acao: string,
  corpo: (tx: Tx) => Promise<R>,
): Promise<R> {
  if (!chaveValida(ctx.chave)) throw new Error('chave de idempotencia invalida')

  const onde = { empresaId_chave: { empresaId: ctx.empresaId, chave: ctx.chave } }
  const anterior = await prisma.mutacao.findUnique({ where: onde, select: { resposta: true } })
  if (anterior?.resposta != null) return anterior.resposta as unknown as R

  try {
    return await prisma.$transaction(
      async (tx) => {
        const registro = await tx.mutacao.create({
          data: { empresaId: ctx.empresaId, chave: ctx.chave, acao, usuarioId: ctx.usuarioId },
          select: { id: true },
        })
        const resposta = await corpo(tx)
        await tx.mutacao.update({ where: { id: registro.id }, data: { resposta: resposta as unknown as Prisma.InputJsonValue } })
        return resposta
      },
      { maxWait: 2_000, timeout: 8_000 },
    )
  } catch (e) {
    if (!violacaoUnica(e)) throw e
    const gravada = await prisma.mutacao.findUnique({ where: onde, select: { resposta: true } })
    if (gravada?.resposta == null) throw new Error('mutacao com a mesma chave ainda em andamento')
    return gravada.resposta as unknown as R
  }
}
