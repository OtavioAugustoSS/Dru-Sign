import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { dinheiro, arredondarCentavos } from '@/domain/precificacao/dinheiro'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { lerDataCalendario } from '@/domain/ordem/datas'

export interface LinhaHistorico {
  id: string
  numero: number
  /** ISO da @db.Date. */
  dataEntrada: string
  dataSaida: string | null
  dataSaidaTexto: string | null
  dataSaidaSuspeita: boolean
  clienteId: string | null
  clienteNome: string
  nomeDestruido: boolean
  telefone: string
  situacao: string
  texto: string
  total: string
  forma: string
  responsavel: string
}

export interface FiltrosHistorico {
  /** Numero exato, ou trecho do nome do cliente ou do texto da ordem. */
  q?: string
  de?: string
  ate?: string
  limite?: number
  /** 1 e a primeira. Junto com `limite`, decide o trecho que a tela mostra. */
  pagina?: number
}

export interface Historico {
  linhas: LinhaHistorico[]
  /** Quantas atendem ao filtro, mesmo quando o limite corta a lista. */
  encontradas: number
  somaTotal: string
}

const LIMITE_PADRAO = 100

function paraLinha(o: {
  id: string; numero: number; dataEntrada: Date; dataSaida: Date | null; dataSaidaTexto: string | null
  dataSaidaSuspeita: boolean; clienteId: string | null; clienteNome: string; nomeDestruido: boolean
  telefone: string; situacao: string; texto: string; total: unknown; forma: string; responsavel: string
}): LinhaHistorico {
  return {
    id: o.id, numero: o.numero,
    dataEntrada: o.dataEntrada.toISOString(),
    dataSaida: o.dataSaida?.toISOString() ?? null,
    dataSaidaTexto: o.dataSaidaTexto,
    dataSaidaSuspeita: o.dataSaidaSuspeita,
    clienteId: o.clienteId, clienteNome: o.clienteNome, nomeDestruido: o.nomeDestruido,
    telefone: o.telefone, situacao: o.situacao, texto: o.texto,
    total: paraDominio(o.total as Parameters<typeof paraDominio>[0]).toFixed(2),
    forma: o.forma, responsavel: o.responsavel,
  }
}

const COLUNAS = {
  id: true, numero: true, dataEntrada: true, dataSaida: true, dataSaidaTexto: true, dataSaidaSuspeita: true,
  clienteId: true, clienteNome: true, nomeDestruido: true, telefone: true, situacao: true, texto: true,
  total: true, forma: true, responsavel: true,
} as const

/** O arquivo e so leitura: nenhuma action escreve aqui, e nada daqui entra em fila ou indicador. */
export async function buscarHistorico(empresaId: string, filtros: FiltrosHistorico): Promise<Historico> {
  const q = filtros.q?.trim() ?? ''
  let periodo = {}
  if (filtros.de && filtros.ate) {
    const d = lerDataCalendario(filtros.de)
    const a = lerDataCalendario(filtros.ate)
    if (!d || !a || d.getTime() > a.getTime()) throw new ErroDeValidacao('Período inválido.')
    periodo = { dataEntrada: { gte: d, lte: a } }
  }
  const where = {
    empresaId,
    ...periodo,
    ...(q === '' ? {} : /^\d+$/.test(q)
      ? { numero: Number(q) }
      : { OR: [{ clienteNome: { contains: q, mode: 'insensitive' as const } }, { texto: { contains: q, mode: 'insensitive' as const } }] }),
  }
  const [linhas, encontradas, soma] = await Promise.all([
    prisma.ordemLegado.findMany({
      where,
      orderBy: [{ dataEntrada: 'desc' }, { numero: 'desc' }],
      skip: filtros.pagina && filtros.pagina > 1 ? (filtros.pagina - 1) * (filtros.limite ?? LIMITE_PADRAO) : 0,
      take: filtros.limite ?? LIMITE_PADRAO,
      select: COLUNAS,
    }),
    prisma.ordemLegado.count({ where }),
    prisma.ordemLegado.aggregate({ where, _sum: { total: true } }),
  ])
  const somaTotal = soma._sum.total ? arredondarCentavos(paraDominio(soma._sum.total)).toFixed(2) : '0.00'
  return { linhas: linhas.map(paraLinha), encontradas, somaTotal: dinheiro(somaTotal).toFixed(2) }
}

/** "O que a gente ja fez para esse cliente" — a pergunta que se faz na frente dele. */
export async function historicoDoCliente(empresaId: string, clienteId: string, limite = 50): Promise<LinhaHistorico[]> {
  const linhas = await prisma.ordemLegado.findMany({
    where: { empresaId, clienteId },
    orderBy: [{ dataEntrada: 'desc' }, { numero: 'desc' }],
    take: limite,
    select: COLUNAS,
  })
  return linhas.map(paraLinha)
}
