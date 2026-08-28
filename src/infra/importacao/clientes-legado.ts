import { randomUUID } from 'node:crypto'
import { lerDbf } from './dbf'
import { converterRegistro } from './conversao-clientes'
import { prisma } from '@/infra/db/prisma'
import { prepararLinhas } from '@/infra/clientes/repositorio'

export { converterRegistro, type ClienteLegado } from './conversao-clientes'

export interface ResultadoImportacao {
  total: number
  arquivados: number
  telefones: number
  inferidos: number
  naoDiscaveis: number
  descartados: number
  jaExistiam: number
}

/** createMany em lotes: 3.219 creates aninhados levam mais de 5 min no Postgres local; em lotes, segundos. */
const TAMANHO_LOTE = 500

function lotes<T>(itens: T[]): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) saida.push(itens.slice(i, i + TAMANHO_LOTE))
  return saida
}

/**
 * Importa todos os registros, inclusive os apagados (viram arquivados). Idempotente por
 * cobertura: se a empresa ja tem algum cliente com codigo legado, nao importa de novo.
 */
export async function importarClientesLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacao> {
  const jaExistiam = await prisma.cliente.count({ where: { empresaId, codigoLegado: { not: null } } })
  const resultado: ResultadoImportacao = {
    total: 0, arquivados: 0, telefones: 0, inferidos: 0, naoDiscaveis: 0, descartados: 0, jaExistiam,
  }
  if (jaExistiam > 0) return resultado

  const agora = new Date()
  const clientes: Array<ReturnType<typeof prepararLinhas>['cliente'] & { id: string }> = []
  const telefones: Array<ReturnType<typeof prepararLinhas>['telefones'][number] & { clienteId: string }> = []

  for (const registro of lerDbf(caminhoDbf).registros) {
    const c = converterRegistro(registro)
    const id = randomUUID()
    const linhas = prepararLinhas(empresaId, c.dados, {
      codigoLegado: c.codigoLegado,
      arquivadoEm: c.apagado ? agora : null,
      ...(c.cadastradoEm ? { criadoEm: c.cadastradoEm } : {}),
    })
    clientes.push({ id, ...linhas.cliente })
    for (const t of linhas.telefones) {
      telefones.push({ clienteId: id, ...t })
      resultado.telefones++
      if (t.normalizado === null) resultado.naoDiscaveis++
      else if (t.inferido) resultado.inferidos++
    }
    resultado.total++
    if (c.apagado) resultado.arquivados++
    resultado.descartados += c.descartados
  }

  // Tudo ou nada: uma falha no meio nao pode deixar clientes sem telefone com o rerun recusando.
  await prisma.$transaction(
    async (tx) => {
      for (const lote of lotes(clientes)) await tx.cliente.createMany({ data: lote })
      for (const lote of lotes(telefones)) await tx.telefoneCliente.createMany({ data: lote })
    },
    { timeout: 180_000 },
  )

  return resultado
}
