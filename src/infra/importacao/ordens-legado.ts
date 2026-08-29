import { lerDbf } from './dbf'
import { prisma } from '@/infra/db/prisma'
import { paraBanco } from '@/infra/db/decimal'
import { dinheiro, arredondarCentavos } from '@/domain/precificacao/dinheiro'
import { converterOrdemLegado } from '@/domain/legado/ordem'

export interface ResultadoImportacaoOrdens {
  total: number
  importadas: number
  jaExistiam: number
  ligadasACliente: number
  semCliente: number
  comDataSaidaImpossivel: number
  comSaidaAntesDaEntrada: number
  comNomeDestruido: number
  /** Soma de TOTAL, para conferir contra o legado: R$ 5.654.432,03. */
  somaTotal: string
}

/** 18.443 linhas de uma vez estouram o parametro maximo do Postgres; em lotes, nao. */
const LOTE = 500

/** Idempotente por cobertura: se a empresa ja tem ordem legada, nao importa de novo. */
export async function importarOrdensLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacaoOrdens> {
  const jaExistiam = await prisma.ordemLegado.count({ where: { empresaId } })
  const vazio = { total: 0, importadas: 0, ligadasACliente: 0, semCliente: 0, comDataSaidaImpossivel: 0, comSaidaAntesDaEntrada: 0, comNomeDestruido: 0, somaTotal: '0.00' }
  if (jaExistiam > 0) return { ...vazio, jaExistiam }

  const linhas = lerDbf(caminhoDbf).registros.filter((r) => !r.apagado)
  const ordens = linhas.map((r) => converterOrdemLegado(r.valores))

  // Uma consulta so para resolver os 3.219 codigos, em vez de 18.443 joins.
  const clientes = await prisma.cliente.findMany({
    where: { empresaId, codigoLegado: { not: null } },
    select: { id: true, codigoLegado: true },
  })
  const porCodigo = new Map(clientes.map((c) => [c.codigoLegado as number, c.id]))

  let soma = dinheiro(0)
  const dados = ordens.map((o) => {
    soma = soma.plus(dinheiro(o.total))
    return {
      empresaId,
      numero: o.numero,
      dataEntrada: o.dataEntrada,
      dataSaida: o.dataSaida,
      dataSaidaTexto: o.dataSaidaTexto,
      dataSaidaSuspeita: o.dataSaidaSuspeita,
      codigoClienteLegado: o.codigoClienteLegado,
      clienteId: o.codigoClienteLegado === null ? null : porCodigo.get(o.codigoClienteLegado) ?? null,
      clienteNome: o.clienteNome.slice(0, 60),
      nomeDestruido: o.nomeDestruido,
      telefone: o.telefone,
      situacao: o.situacao,
      texto: o.texto,
      valorProdutos: paraBanco(dinheiro(o.valorProdutos)),
      valorServicos: paraBanco(dinheiro(o.valorServicos)),
      maoDeObra: paraBanco(dinheiro(o.maoDeObra)),
      deslocamento: paraBanco(dinheiro(o.deslocamento)),
      desconto: paraBanco(dinheiro(o.desconto)),
      total: paraBanco(dinheiro(o.total)),
      forma: o.forma,
      responsavel: o.responsavel,
      usuario: o.usuario,
    }
  })

  for (let i = 0; i < dados.length; i += LOTE) {
    await prisma.ordemLegado.createMany({ data: dados.slice(i, i + LOTE) })
  }

  return {
    total: ordens.length,
    importadas: dados.length,
    jaExistiam: 0,
    ligadasACliente: dados.filter((d) => d.clienteId !== null).length,
    semCliente: dados.filter((d) => d.clienteId === null).length,
    comDataSaidaImpossivel: ordens.filter((o) => o.dataSaidaTexto !== null).length,
    comSaidaAntesDaEntrada: ordens.filter((o) => o.dataSaidaSuspeita).length,
    comNomeDestruido: ordens.filter((o) => o.nomeDestruido).length,
    somaTotal: arredondarCentavos(soma).toFixed(2),
  }
}
