// Uso: npm run importar:clientes [caminho-do-CLIENTES.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarClientesLegado } from '../src/infra/importacao/clientes-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CLIENTES.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const inicio = Date.now()
  const r = await importarClientesLegado(caminho, empresa.id)
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: a empresa "${empresa.razaoSocial}" ja tem ${r.jaExistiam} clientes importados`)
    return
  }
  console.log(
    `${r.total} clientes importados para "${empresa.razaoSocial}" em ${segundos}s: ` +
      `${r.arquivados} arquivados, ${r.telefones} telefones (${r.inferidos} com nono digito inferido, ` +
      `${r.naoDiscaveis} nao discaveis, ${r.descartados} entradas descartadas)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
