// Uso: npm run importar:plano [caminho-do-CONTAS.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarPlanoLegado } from '../src/infra/importacao/plano-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CONTAS.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const r = await importarPlanoLegado(caminho, empresa.id)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: a empresa "${empresa.razaoSocial}" ja tem ${r.jaExistiam} contas importadas`)
    return
  }
  console.log(`${r.total} contas importadas para "${empresa.razaoSocial}" (${r.receitas} receitas, ${r.despesas} despesas); recebimentos vao para "${r.contaRecebimento ?? 'NENHUMA — defina no plano de contas'}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
