import { prisma } from '@/infra/db/prisma'
import { hashSenha } from '@/infra/auth/senha'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface UsuarioTela {
  id: string
  nome: string
  login: string
  papel: PapelUsuario
  ativo: boolean
  criadoEm: string
}

/** Minimo do OWASP para senha sem segundo fator; a loja tem tres pessoas na mesma sala. */
const MINIMO_SENHA = 8

function nomeLimpo(nome: string): string {
  const n = nome.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (n === '') throw new ErroDeValidacao('Informe o nome.')
  return n
}

/** Login e minusculo e sem espaco: quem digita no balcao nao pensa em maiuscula. */
function loginLimpo(login: string): string {
  const l = login.trim().toLowerCase()
  if (!/^[a-z0-9._-]{2,64}$/.test(l)) throw new ErroDeValidacao('O login aceita de 2 a 64 letras, números, ponto, hífen ou sublinhado, sem espaço.')
  return l
}

function papelValido(papel: string): PapelUsuario {
  if (papel !== 'administracao' && papel !== 'operacao') throw new ErroDeValidacao('Escolha o papel.')
  return papel
}

function senhaValida(senha: string): string {
  if (senha.length < MINIMO_SENHA) throw new ErroDeValidacao(`A senha precisa de pelo menos ${MINIMO_SENHA} caracteres.`)
  return senha
}

async function exigirUsuarioDaEmpresa(empresaId: string, id: string) {
  const u = await prisma.usuario.findFirst({ where: { id, empresaId }, select: { id: true, papel: true, ativo: true } })
  if (!u) throw new ErroDeValidacao('Usuário não encontrado.')
  return u
}

export async function listarUsuarios(empresaId: string): Promise<UsuarioTela[]> {
  const linhas = await prisma.usuario.findMany({
    where: { empresaId },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, login: true, papel: true, ativo: true, criadoEm: true },
  })
  return linhas.map((u) => ({ ...u, criadoEm: u.criadoEm.toISOString() }))
}

export async function criarUsuario(empresaId: string, dados: { nome: string; login: string; papel: string; senha: string }): Promise<{ id: string }> {
  const nome = nomeLimpo(dados.nome)
  const login = loginLimpo(dados.login)
  const papel = papelValido(dados.papel)
  const senhaHash = await hashSenha(senhaValida(dados.senha))
  // O login e unico no banco inteiro (@unique no schema), nao por empresa: conferir antes
  // da a mensagem certa em vez do P2002.
  const repetido = await prisma.usuario.findUnique({ where: { login }, select: { id: true } })
  if (repetido) throw new ErroDeValidacao('Já existe um usuário com esse login.')
  return prisma.usuario.create({ data: { empresaId, nome, login, papel, senhaHash }, select: { id: true } })
}

export async function alterarUsuario(empresaId: string, id: string, dados: { nome: string; papel: string }): Promise<void> {
  await exigirUsuarioDaEmpresa(empresaId, id)
  await prisma.usuario.update({ where: { id }, data: { nome: nomeLimpo(dados.nome), papel: papelValido(dados.papel) } })
}

export async function trocarSenha(empresaId: string, id: string, senha: string): Promise<void> {
  await exigirUsuarioDaEmpresa(empresaId, id)
  await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashSenha(senhaValida(senha)) } })
}

/** Nunca apaga: o usuario e responsavel_id de ordens antigas (spec, secao 4). */
export async function alterarAtivoUsuario(empresaId: string, id: string, ativo: boolean, usuarioAtualId: string): Promise<void> {
  const alvo = await exigirUsuarioDaEmpresa(empresaId, id)
  if (!ativo) {
    if (id === usuarioAtualId) throw new ErroDeValidacao('Você não pode desativar o seu próprio acesso.')
    if (alvo.papel === 'administracao') {
      const outras = await prisma.usuario.count({ where: { empresaId, papel: 'administracao', ativo: true, id: { not: id } } })
      if (outras === 0) throw new ErroDeValidacao('Esta é a única administração ativa. Promova outra pessoa antes de desativar.')
    }
  }
  await prisma.usuario.update({ where: { id }, data: { ativo } })
}
