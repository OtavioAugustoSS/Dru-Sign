import { describe, expect, it } from 'vitest'
import { prisma } from '@/infra/db/prisma'

describe('usuario (banco real)', () => {
  it('nasce ativo, com papel operacao e preso a uma empresa', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    const usuario = await prisma.usuario.create({
      data: { empresaId: empresa.id, nome: 'Ana', login: 'ana', senhaHash: 'x' },
    })
    expect(usuario.papel).toBe('operacao')
    expect(usuario.ativo).toBe(true)
    expect(usuario.empresaId).toBe(empresa.id)
  })

  it('login e unico', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    await prisma.usuario.create({
      data: { empresaId: empresa.id, nome: 'Ana', login: 'ana', senhaHash: 'x' },
    })
    await expect(
      prisma.usuario.create({
        data: { empresaId: empresa.id, nome: 'Outra Ana', login: 'ana', senhaHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('o TRUNCATE entre testes deixa o banco vazio', async () => {
    expect(await prisma.usuario.count()).toBe(0)
    expect(await prisma.empresa.count()).toBe(0)
  })
})
