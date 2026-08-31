/**
 * Desfaz a leva de dados de exemplo. Ver `scripts/dados-exemplo.ts`.
 *
 * Apaga o que nasceu DEPOIS da hora gravada na marca e devolve o contador de OS.
 * A ordem das exclusões segue as chaves estrangeiras: recebimento aponta para
 * lançamento, item e acréscimo apontam para a ordem, e a ordem sai por último.
 *
 * O que ele NÃO toca: cliente, material, conta do plano e usuário. O seed não
 * cria nenhum deles — usa os que já existem — justamente para que desfazer seja
 * apagar ordens e lançamentos, e nada mais.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { MARCA, exigirBancoLocal, type Marca } from './exemplo-marca'

exigirBancoLocal(process.env.DATABASE_URL)

if (!existsSync(MARCA)) {
  console.log('Nenhuma marca encontrada: não há dados de exemplo para remover.')
  process.exit(0)
}
const m = JSON.parse(readFileSync(MARCA, 'utf8')) as Marca
const { empresaId } = m
const nascidoDepois = { gte: new Date(m.inicio) }

const ordens = await prisma.ordemServico.findMany({
  where: { empresaId, criadoEm: nascidoDepois },
  select: { id: true },
})
const ordemIds = ordens.map((o) => o.id)

await prisma.$transaction([
  // Recebimento antes do lançamento: um aponta para o outro.
  prisma.recebimento.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
  prisma.lancamentoCaixa.deleteMany({ where: { empresaId, criadoEm: nascidoDepois } }),
  prisma.acrescimoOrdem.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
  prisma.itemOrdem.deleteMany({ where: { empresaId, ordemId: { in: ordemIds } } }),
  // A trava de idempotência de cada chamada que o seed fez.
  prisma.mutacao.deleteMany({ where: { empresaId, criadaEm: nascidoDepois } }),
  prisma.ordemServico.deleteMany({ where: { empresaId, id: { in: ordemIds } } }),
  // A numeração não volta sozinha: é um contador, não uma sequence.
  prisma.contadorEmpresa.updateMany({ where: { empresaId }, data: { proximaOs: m.proximaOsAntes } }),
], { timeout: 120_000 })

rmSync(MARCA, { force: true })
console.log(`removidos: ${ordemIds.length} ordens e o que nasceu junto; próxima OS de volta em ${m.proximaOsAntes}.`)
await prisma.$disconnect()
