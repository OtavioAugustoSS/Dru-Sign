import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { ajusteDesatualizado, type EstadoProducao } from '@/domain/ordem/estados'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import type { TipoAcrescimo } from '@/domain/precificacao/resolucao'

/** Tudo serializavel: dinheiro em string, datas em ISO. Vai para Server e Client Components. */
export interface ItemTela {
  id: string
  descricao: string
  quantidade: number
  altura: string | null
  largura: string | null
  unidadeCobranca: UnidadeCobranca
  valorUnitario: string
  total: string
}

export interface AcrescimoTela {
  id: string
  tipo: TipoAcrescimo
  descricao: string
  valor: string
}

export interface OrdemTela {
  id: string
  numero: number
  estadoProducao: EstadoProducao
  versao: number
  cliente: { id: string | null; nome: string; apelido: string | null; telefone: string | null } | null
  responsavel: { id: string; nome: string }
  observacoes: string | null
  abertaEm: string
  prometidaPara: string | null
  aprovadoEm: string | null
  precoAprovado: string | null
  canceladaEm: string | null
  motivoCancelamento: string | null
  subtotalItens: string
  subtotalAcrescimos: string
  precoCalculado: string
  precoFinal: string
  ajuste: { motivo: string; por: string; precoCalculadoNoAjuste: string; desatualizado: boolean } | null
  itens: ItemTela[]
  acrescimos: AcrescimoTela[]
}

type Dec = Parameters<typeof paraDominio>[0]
const d2 = (v: Dec) => paraDominio(v).toFixed(2)
const d4 = (v: Dec | null) => (v === null ? null : paraDominio(v).toFixed(4))

export async function obterOrdemParaTela(empresaId: string, id: string): Promise<OrdemTela | null> {
  const o = await prisma.ordemServico.findFirst({
    where: { id, empresaId },
    include: {
      responsavel: { select: { id: true, nome: true } },
      ajustadoPor: { select: { nome: true } },
      itens: { where: { removidoEm: null }, orderBy: { ordemExibicao: 'asc' } },
      acrescimos: { where: { removidoEm: null }, orderBy: { criadoEm: 'asc' } },
    },
  })
  if (!o) return null
  const precoCalculado = d2(o.precoCalculado)
  const precoCalculadoNoAjuste = o.precoCalculadoNoAjuste === null ? null : d2(o.precoCalculadoNoAjuste)
  return {
    id: o.id,
    numero: o.numero,
    estadoProducao: o.estadoProducao,
    versao: o.versao,
    cliente: o.clienteNome === null ? null : { id: o.clienteId, nome: o.clienteNome, apelido: o.clienteApelido, telefone: o.clienteTelefone },
    responsavel: o.responsavel,
    observacoes: o.observacoes,
    abertaEm: o.abertaEm.toISOString(),
    prometidaPara: o.prometidaPara?.toISOString() ?? null,
    aprovadoEm: o.aprovadoEm?.toISOString() ?? null,
    precoAprovado: o.precoAprovado === null ? null : d2(o.precoAprovado),
    canceladaEm: o.canceladaEm?.toISOString() ?? null,
    motivoCancelamento: o.motivoCancelamento,
    subtotalItens: d2(o.subtotalItens),
    subtotalAcrescimos: d2(o.subtotalAcrescimos),
    precoCalculado,
    precoFinal: d2(o.precoFinal),
    ajuste: o.ajustadoPorId === null || o.motivoAjuste === null ? null : {
      motivo: o.motivoAjuste,
      por: o.ajustadoPor?.nome ?? '',
      precoCalculadoNoAjuste: precoCalculadoNoAjuste ?? precoCalculado,
      desatualizado: ajusteDesatualizado({ temAjuste: true, precoCalculado, precoCalculadoNoAjuste }),
    },
    itens: o.itens.map((i) => ({
      id: i.id, descricao: i.descricao, quantidade: i.quantidade, altura: d4(i.altura), largura: d4(i.largura),
      unidadeCobranca: i.unidadeCobranca, valorUnitario: d2(i.valorUnitario), total: d2(i.total),
    })),
    acrescimos: o.acrescimos.map((a) => ({ id: a.id, tipo: a.tipo, descricao: a.descricao, valor: d2(a.valor) })),
  }
}

export interface OrdemResumo {
  id: string
  numero: number
  estadoProducao: EstadoProducao
  clienteNome: string | null
  clienteApelido: string | null
  abertaEm: string
  prometidaPara: string | null
  precoFinal: string
}

export async function listarOrdens(empresaId: string, opcoes: { limite?: number } = {}): Promise<OrdemResumo[]> {
  const linhas = await prisma.ordemServico.findMany({
    where: { empresaId },
    orderBy: { numero: 'desc' },
    take: opcoes.limite ?? 100,
    select: { id: true, numero: true, estadoProducao: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, precoFinal: true },
  })
  return linhas.map((o) => ({
    id: o.id, numero: o.numero, estadoProducao: o.estadoProducao, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
    abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null, precoFinal: d2(o.precoFinal),
  }))
}
