// A ordem dos imports importa: carrega-env precisa rodar antes de prisma.ts avaliar env().
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { hashSenha } from '../src/infra/auth/senha'

const EMPRESA_ID = '01900000-0000-7000-8000-000000000001'

async function garantirUsuario(
  empresaId: string,
  login: string,
  nome: string,
  papel: 'administracao' | 'operacao',
  senha: string,
): Promise<void> {
  // Idempotente: rodar de novo nao troca a senha de quem ja existe.
  const usuario = await prisma.usuario.upsert({
    where: { login },
    update: {},
    create: { empresaId, nome, login, senhaHash: await hashSenha(senha), papel },
  })
  console.log(`usuario "${usuario.login}" (${usuario.papel}) pronto`)
}

async function main(): Promise<void> {
  const loginAdmin = (process.env.SEED_ADMIN_LOGIN ?? 'admin').trim().toLowerCase()
  const senhaAdmin = process.env.SEED_ADMIN_SENHA
  if (!senhaAdmin || senhaAdmin.length < 8) {
    throw new Error('Defina SEED_ADMIN_SENHA (minimo 8 caracteres) em .env.local ou no ambiente')
  }

  const empresa = await prisma.empresa.upsert({
    where: { id: EMPRESA_ID },
    update: {},
    create: { id: EMPRESA_ID, razaoSocial: 'DruSign Placas e Comunicacao Visual' },
  })
  console.log(`empresa "${empresa.razaoSocial}" pronta`)

  await garantirUsuario(empresa.id, loginAdmin, 'Administrador', 'administracao', senhaAdmin)

  // Usuario de operacao (producao), opcional: existe para testar que ele NAO entra na administracao.
  const senhaOperacao = process.env.SEED_OPERACAO_SENHA
  if (senhaOperacao && senhaOperacao.length >= 8) {
    const loginOperacao = (process.env.SEED_OPERACAO_LOGIN ?? 'producao').trim().toLowerCase()
    await garantirUsuario(empresa.id, loginOperacao, 'Produção', 'operacao', senhaOperacao)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
