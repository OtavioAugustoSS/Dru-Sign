import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import { executarUmaVez, type Contexto } from './idempotencia'

let ctx: Contexto

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete', login: 'odete', senhaHash: 'x' } })
  ctx = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

describe('executarUmaVez', () => {
  it('executa uma vez e grava a resposta; a mesma chave devolve a resposta sem executar', async () => {
    let execucoes = 0
    const corpo = async () => { execucoes++; return { ok: true, n: 42 } }
    const a = await executarUmaVez(ctx, 'teste', corpo)
    const b = await executarUmaVez(ctx, 'teste', corpo)
    expect(a).toEqual({ ok: true, n: 42 })
    expect(b).toEqual(a)
    expect(execucoes).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: ctx.empresaId } })).toBe(1)
  })

  it('erro no corpo faz rollback da chave: a proxima tentativa executa de novo', async () => {
    await expect(executarUmaVez(ctx, 'teste', async () => { throw new Error('falhou') })).rejects.toThrow('falhou')
    expect(await prisma.mutacao.count({ where: { empresaId: ctx.empresaId } })).toBe(0)
    expect(await executarUmaVez(ctx, 'teste', async () => ({ ok: true }))).toEqual({ ok: true })
  })

  it('o que o corpo grava com tx e o registro da chave sao atomicos', async () => {
    await expect(executarUmaVez(ctx, 'teste', async (tx) => {
      await tx.empresa.create({ data: { razaoSocial: 'Nao deve existir' } })
      throw new Error('depois de gravar')
    })).rejects.toThrow()
    expect(await prisma.empresa.count({ where: { razaoSocial: 'Nao deve existir' } })).toBe(0)
  })

  it('chave invalida e recusada antes de tocar no banco', async () => {
    await expect(executarUmaVez({ ...ctx, chave: 'abc' }, 'teste', async () => ({}))).rejects.toThrow(/chave/)
  })
})
