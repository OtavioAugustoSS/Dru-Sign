import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { verificarSenha } from '@/infra/auth/senha'
import { listarUsuarios, criarUsuario, alterarUsuario, alterarAtivoUsuario, trocarSenha } from './repositorio'

let empresaId = ''
let odeteId = ''

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const odete = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  empresaId = empresa.id
  odeteId = odete.id
})

describe('usuarios (banco real)', () => {
  it('cria com senha em Argon2, lista sem o hash e nunca repete login', async () => {
    const novo = await criarUsuario(empresaId, { nome: '  Pedro Souza ', login: '  Pedro ', papel: 'operacao', senha: 'senha-boa-123' })
    const gravado = await prisma.usuario.findUniqueOrThrow({ where: { id: novo.id } })
    expect(gravado).toMatchObject({ nome: 'Pedro Souza', login: 'pedro', papel: 'operacao', ativo: true })
    expect(gravado.senhaHash.startsWith('$argon2id$')).toBe(true)
    expect(await verificarSenha(gravado.senhaHash, 'senha-boa-123')).toBe(true)

    const lista = await listarUsuarios(empresaId)
    expect(lista.map((u) => [u.login, u.papel, u.ativo])).toEqual([['odete', 'administracao', true], ['pedro', 'operacao', true]])
    expect(JSON.stringify(lista)).not.toContain('argon2')

    await expect(criarUsuario(empresaId, { nome: 'Outro', login: 'PEDRO', papel: 'operacao', senha: 'senha-boa-123' })).rejects.toThrow(/já existe/)
  })

  it.each([
    [{ nome: '', login: 'x', papel: 'operacao', senha: 'senha-boa-123' }, /nome/],
    [{ nome: 'X', login: '', papel: 'operacao', senha: 'senha-boa-123' }, /login/],
    [{ nome: 'X', login: 'com espaco', papel: 'operacao', senha: 'senha-boa-123' }, /login/],
    [{ nome: 'X', login: 'xx', papel: 'chefe', senha: 'senha-boa-123' }, /papel/],
    [{ nome: 'X', login: 'xx', papel: '', senha: 'senha-boa-123' }, /papel/],
    [{ nome: 'X', login: 'xx', papel: 'operacao', senha: 'curta' }, /senha/],
  ])('recusa %j', async (dados: { nome: string; login: string; papel: string; senha: string }, erro: RegExp) => {
    await expect(criarUsuario(empresaId, dados)).rejects.toThrow(erro)
  })

  it('altera nome e papel; troca de senha grava hash novo e nao mexe no resto', async () => {
    const p = await criarUsuario(empresaId, { nome: 'Pedro', login: 'pedro', papel: 'operacao', senha: 'senha-boa-123' })
    await alterarUsuario(empresaId, p.id, { nome: 'Pedro Souza', papel: 'administracao' })
    expect(await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ nome: 'Pedro Souza', papel: 'administracao', login: 'pedro' })

    const antes = (await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).senhaHash
    await trocarSenha(empresaId, p.id, 'outra-senha-boa')
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })
    expect(depois.senhaHash).not.toBe(antes)
    expect(await verificarSenha(depois.senhaHash, 'outra-senha-boa')).toBe(true)
    await expect(trocarSenha(empresaId, p.id, 'curta')).rejects.toThrow(/senha/)
  })

  it('desativa e reativa, mas ninguem se desativa e a ultima administracao ativa nao sai', async () => {
    const p = await criarUsuario(empresaId, { nome: 'Pedro', login: 'pedro', papel: 'operacao', senha: 'senha-boa-123' })
    await alterarAtivoUsuario(empresaId, p.id, false, odeteId)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).ativo).toBe(false)
    expect((await listarUsuarios(empresaId)).find((u) => u.id === p.id)?.ativo).toBe(false) // desativado continua na lista

    await alterarAtivoUsuario(empresaId, p.id, true, odeteId)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.id } })).ativo).toBe(true)

    await expect(alterarAtivoUsuario(empresaId, odeteId, false, odeteId)).rejects.toThrow(/você mesma/)
    const outraAdmin = await criarUsuario(empresaId, { nome: 'Otavio', login: 'otavio', papel: 'administracao', senha: 'senha-boa-123' })
    await alterarAtivoUsuario(empresaId, outraAdmin.id, false, odeteId)
    await expect(alterarAtivoUsuario(empresaId, odeteId, false, outraAdmin.id)).rejects.toThrow(/única administração/)
  })

  it('usuario de outra empresa nao e visto nem alterado', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const alheio = await prisma.usuario.create({ data: { empresaId: outra.id, nome: 'Estranho', login: 'estranho', senhaHash: 'x' } })
    expect((await listarUsuarios(empresaId)).map((u) => u.id)).toEqual([odeteId])
    await expect(alterarUsuario(empresaId, alheio.id, { nome: 'X', papel: 'operacao' })).rejects.toThrow(/não encontrado/)
    await expect(trocarSenha(empresaId, alheio.id, 'senha-boa-123')).rejects.toThrow(/não encontrado/)
    await expect(alterarAtivoUsuario(empresaId, alheio.id, false, odeteId)).rejects.toThrow(/não encontrado/)
  })
})
