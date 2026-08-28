import { describe, expect, it } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { criarSessao, validarSessao, encerrarSessao, DURACAO_SESSAO_SEGUNDOS } from './sessao'

async function criarUsuario(ativo = true) {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  return prisma.usuario.create({
    data: { empresaId: empresa.id, nome: 'Odete', login: 'odete', senhaHash: 'x', papel: 'administracao', ativo },
  })
}

describe('sessao no banco', () => {
  it('cria e valida uma sessao de 12 horas', async () => {
    const usuario = await criarUsuario()
    const agora = new Date('2026-08-28T08:00:00-03:00')
    const { id, expiraEm } = await criarSessao(usuario.id, agora)

    expect(id).toHaveLength(43) // 32 bytes em base64url
    expect(expiraEm.getTime() - agora.getTime()).toBe(DURACAO_SESSAO_SEGUNDOS * 1000)
    expect(DURACAO_SESSAO_SEGUNDOS).toBe(12 * 60 * 60)

    expect(await validarSessao(id, agora)).toEqual({
      id: usuario.id,
      empresaId: usuario.empresaId,
      login: 'odete',
      nome: 'Odete',
      papel: 'administracao',
    })
  })

  it('rejeita sessao expirada', async () => {
    const usuario = await criarUsuario()
    const agora = new Date('2026-08-28T08:00:00-03:00')
    const { id } = await criarSessao(usuario.id, agora)
    const noLimite = new Date(agora.getTime() + DURACAO_SESSAO_SEGUNDOS * 1000)
    expect(await validarSessao(id, noLimite)).toBeNull()
  })

  it('rejeita sessao de usuario desativado', async () => {
    const usuario = await criarUsuario()
    const { id } = await criarSessao(usuario.id)
    await prisma.usuario.update({ where: { id: usuario.id }, data: { ativo: false } })
    expect(await validarSessao(id)).toBeNull()
  })

  it('rejeita id ausente ou desconhecido', async () => {
    expect(await validarSessao(undefined)).toBeNull()
    expect(await validarSessao('nao-existe')).toBeNull()
  })

  it('encerrar apaga a sessao e e idempotente', async () => {
    const usuario = await criarUsuario()
    const { id } = await criarSessao(usuario.id)
    await encerrarSessao(id)
    expect(await validarSessao(id)).toBeNull()
    await encerrarSessao(id)
    await encerrarSessao(undefined)
    expect(await prisma.sessao.count()).toBe(0)
  })
})
