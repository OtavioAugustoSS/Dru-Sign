import { randomBytes } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { PapelUsuario } from '@/domain/usuarios/tipos'

/** Turno de trabalho: 12 h. Com sessao no banco, `expiraEm` e a fonte de verdade; o cookie so espelha. */
export const DURACAO_SESSAO_SEGUNDOS = 12 * 60 * 60

export interface UsuarioSessao {
  id: string
  empresaId: string
  login: string
  nome: string
  papel: PapelUsuario
}

export interface SessaoCriada {
  id: string
  expiraEm: Date
}

/** Cria a linha em `sessao` com um id opaco de 32 bytes. Quem chama grava o id no cookie. */
export async function criarSessao(usuarioId: string, agora: Date = new Date()): Promise<SessaoCriada> {
  const id = randomBytes(32).toString('base64url')
  const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_SEGUNDOS * 1000)
  await prisma.sessao.create({ data: { id, usuarioId, expiraEm } })
  return { id, expiraEm }
}

/** Valida no banco: a sessao existe, nao expirou e o usuario continua ativo. */
export async function validarSessao(
  id: string | undefined,
  agora: Date = new Date(),
): Promise<UsuarioSessao | null> {
  if (!id) return null
  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: {
      usuario: { select: { id: true, empresaId: true, login: true, nome: true, papel: true, ativo: true } },
    },
  })
  if (!sessao || sessao.expiraEm <= agora || !sessao.usuario.ativo) return null

  const { id: usuarioId, empresaId, login, nome, papel } = sessao.usuario
  return { id: usuarioId, empresaId, login, nome, papel }
}

/** Apagar uma sessao nao e apagar dado de negocio: e o unico DELETE permitido no sistema. */
export async function encerrarSessao(id: string | undefined): Promise<void> {
  if (!id) return
  await prisma.sessao.deleteMany({ where: { id } })
}
