import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { ajusteDesatualizado, type EstadoProducao, type EstadoPagamento } from '@/domain/ordem/estados'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import type { TipoAcrescimo } from '@/domain/precificacao/resolucao'
import { resumirPagamento } from '@/domain/caixa/pagamento'
import type { FormaPagamento } from '@/domain/caixa/formas'
import { limitesDoDia } from '@/domain/ordem/datas'
import { totalRecebidoPorOrdem } from '@/infra/caixa/resumo'

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

export interface RecebimentoTela {
  id: string
  /** ISO da @db.Date. */
  data: string
  valor: string
  forma: FormaPagamento
  observacao: string | null
  usuario: string
  estornadoEm: string | null
  motivoEstorno: string | null
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
  concluidaEm: string | null
  pagamento: { estado: EstadoPagamento; totalRecebido: string; saldo: string }
  recebimentos: RecebimentoTela[]
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
      recebimentos: { orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }], include: { usuario: { select: { nome: true } } } },
    },
  })
  if (!o) return null
  const vivos = o.recebimentos.filter((r) => r.estornadoEm === null).map((r) => paraDominio(r.valor).toFixed())
  const pagamento = resumirPagamento(paraDominio(o.precoFinal).toFixed(), vivos)
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
    concluidaEm: o.concluidaEm?.toISOString() ?? null,
    pagamento: { estado: pagamento.estado, totalRecebido: pagamento.totalRecebido.toFixed(2), saldo: pagamento.saldo.toFixed(2) },
    recebimentos: o.recebimentos.map((r) => ({
      id: r.id, data: r.data.toISOString(), valor: d2(r.valor), forma: r.forma, observacao: r.observacao, usuario: r.usuario.nome,
      estornadoEm: r.estornadoEm?.toISOString() ?? null, motivoEstorno: r.motivoEstorno,
    })),
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
  estadoPagamento: EstadoPagamento
  saldo: string
}

export interface FiltrosOrdens {
  /** Numero da OS (so digitos) ou trecho do nome/apelido do cliente. */
  q?: string
  estado?: EstadoProducao
  /** 'AAAA-MM-DD', sobre aberta_em no calendario de Sao Paulo. */
  de?: string
  ate?: string
  limite?: number
}

export async function listarOrdens(empresaId: string, filtros: FiltrosOrdens = {}): Promise<OrdemResumo[]> {
  const q = filtros.q?.trim() ?? ''
  const periodo = filtros.de && filtros.ate ? limitesDoDia(filtros.de, filtros.ate) : null
  if (filtros.de && filtros.ate && !periodo) return []
  const linhas = await prisma.ordemServico.findMany({
    where: {
      empresaId,
      ...(filtros.estado ? { estadoProducao: filtros.estado } : {}),
      ...(periodo ? { abertaEm: { gte: periodo.inicio, lt: periodo.fim } } : {}),
      ...(q === '' ? {} : /^\d+$/.test(q)
        ? { numero: Number(q) }
        : { OR: [{ clienteNome: { contains: q, mode: 'insensitive' } }, { clienteApelido: { contains: q, mode: 'insensitive' } }] }),
    },
    orderBy: { numero: 'desc' },
    take: filtros.limite ?? 100,
    select: { id: true, numero: true, estadoProducao: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, precoFinal: true },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, linhas.map((o) => o.id))
  return linhas.map((o) => {
    const p = resumirPagamento(paraDominio(o.precoFinal).toFixed(), [totais.get(o.id) ?? '0.00'])
    return {
      id: o.id, numero: o.numero, estadoProducao: o.estadoProducao, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
      abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null, precoFinal: d2(o.precoFinal),
      estadoPagamento: p.estado, saldo: p.saldo.toFixed(2),
    }
  })
}
