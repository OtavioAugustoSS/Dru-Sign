import { lerDbf } from './dbf'
import { prisma } from '@/infra/db/prisma'
import { converterContaLegado } from '@/domain/caixa/plano'

export interface ResultadoImportacaoPlano {
  total: number
  receitas: number
  despesas: number
  jaExistiam: number
  /** Nome da conta que passou a receber as vendas; null se o codigo 1 nao for uma receita. */
  contaRecebimento: string | null
}

/** Codigo 1 do legado = VENDAS DIVERSAS: 14.692 dos 14.692 titulos com conta apontam para ela. */
const CODIGO_VENDAS = 1

/** Idempotente por cobertura: se a empresa ja tem conta com codigo legado, nao importa de novo. */
export async function importarPlanoLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacaoPlano> {
  const jaExistiam = await prisma.contaPlano.count({ where: { empresaId, codigoLegado: { not: null } } })
  if (jaExistiam > 0) return { total: 0, receitas: 0, despesas: 0, jaExistiam, contaRecebimento: null }

  const contas = lerDbf(caminhoDbf).registros.filter((r) => !r.apagado).map((r) => converterContaLegado(r.valores))
  const vendas = contas.find((c) => c.codigo === CODIGO_VENDAS && c.tipo === 'receita')

  await prisma.$transaction(async (tx) => {
    await tx.contaPlano.createMany({
      data: contas.map((c) => ({ empresaId, codigo: c.codigo, codigoLegado: c.codigo, nome: c.nome, nivel: c.nivel, tipo: c.tipo, grupo: c.grupo })),
    })
    if (vendas) {
      const conta = await tx.contaPlano.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo: vendas.codigo } }, select: { id: true } })
      await tx.empresa.update({ where: { id: empresaId }, data: { contaRecebimentoId: conta.id } })
    }
  })

  return {
    total: contas.length,
    receitas: contas.filter((c) => c.tipo === 'receita').length,
    despesas: contas.filter((c) => c.tipo === 'despesa').length,
    jaExistiam: 0,
    contaRecebimento: vendas?.nome ?? null,
  }
}
