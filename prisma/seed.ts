// A ordem dos imports importa: carrega-env precisa rodar antes de prisma.ts avaliar env().
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { hashSenha } from '../src/infra/auth/senha'

const EMPRESA_ID = '01900000-0000-7000-8000-000000000001'

async function main(): Promise<void> {
  const login = (process.env.SEED_ADMIN_LOGIN ?? 'admin').trim().toLowerCase()
  const senha = process.env.SEED_ADMIN_SENHA
  if (!senha || senha.length < 8) {
    throw new Error('Defina SEED_ADMIN_SENHA (minimo 8 caracteres) em .env.local ou no ambiente')
  }

  const empresa = await prisma.empresa.upsert({
    where: { id: EMPRESA_ID },
    update: {},
    create: { id: EMPRESA_ID, razaoSocial: 'DruSign Placas e Comunicacao Visual' },
  })

  // Idempotente: rodar de novo nao troca a senha de quem ja existe.
  const usuario = await prisma.usuario.upsert({
    where: { login },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Administrador',
      login,
      senhaHash: await hashSenha(senha),
      papel: 'administracao',
    },
  })

  console.log(`empresa "${empresa.razaoSocial}" e usuario "${usuario.login}" (${usuario.papel}) prontos`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
