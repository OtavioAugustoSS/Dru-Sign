// Uso: npm run importar:ordens [caminho-do-ORDEM.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarOrdensLegado } from '../src/infra/importacao/ordens-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/ORDEM.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const r = await importarOrdensLegado(caminho, empresa.id)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: "${empresa.razaoSocial}" ja tem ${r.jaExistiam} ordens legadas`)
    return
  }
  console.log(`${r.importadas} ordens legadas importadas para "${empresa.razaoSocial}" (soma R$ ${r.somaTotal})`)
  console.log(`  ligadas a um cliente do cadastro: ${r.ligadasACliente} · sem cliente: ${r.semCliente}`)
  console.log(`  nome destruido pelo legado: ${r.comNomeDestruido} · saida antes da entrada: ${r.comSaidaAntesDaEntrada} · data de saida impossivel: ${r.comDataSaidaImpossivel}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
