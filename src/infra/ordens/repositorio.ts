import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { calcularItem } from '@/domain/precificacao/formulas'
import { comporOrdem } from '@/domain/precificacao/ordem'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { ItemCobranca, UnidadeCobranca } from '@/domain/precificacao/tipos'
import type { TipoAcrescimo } from '@/domain/precificacao/resolucao'
import { transicionar, type EstadoProducao } from '@/domain/ordem/estados'
import { lerDataCalendario } from '@/domain/ordem/datas'
import { executarUmaVez, type Contexto, type Tx } from '@/infra/mutacoes/idempotencia'

export class ConflitoVersao extends Error {
  constructor() {
    super('a ordem mudou desde a ultima leitura')
  }
}
export class OrdemNaoEditavel extends Error {
  constructor(estado: string) {
    super(`ordem ${estado}: nao aceita esta alteracao`)
  }
}

export interface DadosItem {
  descricao: string
  materialId: string | null
  quantidade: number
  /** Em metros, como string decimal; null quando nao informada. */
  altura: string | null
  largura: string | null
  unidadeCobranca: UnidadeCobranca
  /** String decimal ('61.00'). */
  valorUnitario: string
}

export interface DadosAcrescimo {
  tipo: TipoAcrescimo
  descricao: string
  valor: string
}

export interface DadosCabecalho {
  clienteId?: string | null
  /** 'AAAA-MM-DD' ou null. */
  prometidaPara?: string | null
  responsavelId?: string
  observacoes?: string | null
}

/** JSON puro: e o que a action devolve e o que a tabela mutacao guarda. */
export interface Totais {
  versao: number
  subtotalItens: string
  subtotalAcrescimos: string
  precoCalculado: string
  precoFinal: string
}

/** Itens e acrescimos vivos: o unico lugar onde o filtro de removido e escrito. */
const VIVOS = { removidoEm: null } as const

function editavel(estado: EstadoProducao): boolean {
  return estado === 'orcamento' || estado === 'aberta'
}

async function carregar(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await tx.ordemServico.findFirst({
    where: { id: ordemId, empresaId: ctx.empresaId },
    select: { id: true, estadoProducao: true, versao: true, ajustadoPorId: true, precoFinal: true, precoCalculadoNoAjuste: true },
  })
  if (!ordem) throw new Error('ordem nao encontrada')
  if (ordem.versao !== versao) throw new ConflitoVersao()
  return ordem
}

async function carregarEditavel(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await carregar(tx, ctx, ordemId, versao)
  if (!editavel(ordem.estadoProducao)) throw new OrdemNaoEditavel(ordem.estadoProducao)
  return ordem
}

/**
 * Rele itens e acrescimos vivos, recompoe pelo dominio (strings exatas, nunca Number) e grava
 * com a trava: updateMany pela versao lida; 0 linhas = alguem gravou antes -> rollback.
 * Com ajuste manual, preco_final fica como esta (spec, secao 5).
 */
async function recalcular(tx: Tx, ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  const [itens, acrescimos, ordem] = await Promise.all([
    tx.itemOrdem.findMany({ where: { ordemId, empresaId: ctx.empresaId, ...VIVOS } }),
    tx.acrescimoOrdem.findMany({ where: { ordemId, empresaId: ctx.empresaId, ...VIVOS } }),
    tx.ordemServico.findFirstOrThrow({ where: { id: ordemId, empresaId: ctx.empresaId }, select: { ajustadoPorId: true, precoFinal: true } }),
  ])
  const cobrancas: ItemCobranca[] = itens.map((i) => ({
    unidade: i.unidadeCobranca,
    quantidade: i.quantidade,
    valorUnitario: paraDominio(i.valorUnitario).toFixed(),
    altura: i.altura ? paraDominio(i.altura).toFixed() : undefined,
    largura: i.largura ? paraDominio(i.largura).toFixed() : undefined,
  }))
  const temAjuste = ordem.ajustadoPorId !== null
  const c = comporOrdem(
    cobrancas,
    acrescimos.map((a) => ({ tipo: a.tipo, descricao: a.descricao, valor: paraDominio(a.valor).toFixed() })),
    temAjuste ? paraDominio(ordem.precoFinal).toFixed() : undefined,
  )
  const { count } = await tx.ordemServico.updateMany({
    where: { id: ordemId, empresaId: ctx.empresaId, versao },
    data: {
      subtotalItens: paraBanco(c.subtotalItens),
      subtotalAcrescimos: paraBanco(c.subtotalAcrescimos),
      precoCalculado: paraBanco(c.precoCalculado),
      precoFinal: paraBanco(c.precoFinal),
      versao: { increment: 1 },
    },
  })
  if (count === 0) throw new ConflitoVersao()
  return {
    versao: versao + 1,
    subtotalItens: c.subtotalItens.toFixed(2),
    subtotalAcrescimos: c.subtotalAcrescimos.toFixed(2),
    precoCalculado: c.precoCalculado.toFixed(2),
    precoFinal: c.precoFinal.toFixed(2),
  }
}

async function snapshotCliente(tx: Tx, empresaId: string, clienteId: string | null | undefined) {
  if (!clienteId) return { clienteId: null, clienteNome: null, clienteApelido: null, clienteTelefone: null }
  const c = await tx.cliente.findFirst({
    where: { id: clienteId, empresaId },
    select: { id: true, nome: true, apelido: true, telefones: { orderBy: { ordem: 'asc' }, take: 1, select: { original: true } } },
  })
  if (!c) throw new ErroDeValidacao('cliente nao encontrado')
  return { clienteId: c.id, clienteNome: c.nome, clienteApelido: c.apelido, clienteTelefone: c.telefones[0]?.original ?? null }
}

export async function criarOrdem(
  ctx: Contexto,
  dados: { estado: 'orcamento' | 'aberta'; clienteId?: string | null; prometidaPara?: string | null; responsavelId?: string },
): Promise<{ id: string; numero: number; versao: number }> {
  return executarUmaVez(ctx, 'ordem.criar', async (tx) => {
    // Row lock ate o commit: sem buraco e sem duplicata, por empresa.
    const contador = await tx.contadorEmpresa.update({
      where: { empresaId: ctx.empresaId },
      data: { proximaOs: { increment: 1 } },
      select: { proximaOs: true },
    })
    const snapshot = await snapshotCliente(tx, ctx.empresaId, dados.clienteId)
    const prometida = dados.prometidaPara ? lerDataCalendario(dados.prometidaPara) : null
    return tx.ordemServico.create({
      data: {
        empresaId: ctx.empresaId,
        numero: contador.proximaOs - 1,
        estadoProducao: dados.estado,
        responsavelId: dados.responsavelId ?? ctx.usuarioId,
        prometidaPara: prometida,
        ...snapshot,
      },
      select: { id: true, numero: true, versao: true },
    })
  })
}

function colunasItem(ctx: Contexto, dados: DadosItem) {
  const cobranca: ItemCobranca = {
    unidade: dados.unidadeCobranca,
    quantidade: dados.quantidade,
    valorUnitario: dados.valorUnitario,
    altura: dados.altura ?? undefined,
    largura: dados.largura ?? undefined,
  }
  const r = calcularItem(cobranca) // valida (quantidade, medida) e da o total congelado
  const dim = (v: string | null) => (v === null ? null : paraBanco(dinheiro(v).toDecimalPlaces(4)))
  return {
    empresaId: ctx.empresaId,
    descricao: dados.descricao.trim().slice(0, 160),
    materialId: dados.materialId,
    quantidade: dados.quantidade,
    altura: dim(dados.altura),
    largura: dim(dados.largura),
    unidadeCobranca: dados.unidadeCobranca,
    valorUnitario: paraBanco(dinheiro(dados.valorUnitario)),
    total: paraBanco(r.total),
  }
}

export async function adicionarItem(ctx: Contexto, ordemId: string, versao: number, dados: DadosItem): Promise<Totais> {
  if (dados.descricao.trim() === '') throw new ErroDeValidacao('descreva o item')
  const colunas = colunasItem(ctx, dados) // lanca ErroDeValidacao antes de abrir a transacao
  return executarUmaVez(ctx, 'item.adicionar', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const ultimo = await tx.itemOrdem.aggregate({ where: { ordemId }, _max: { ordemExibicao: true } })
    await tx.itemOrdem.create({ data: { ...colunas, ordemId, ordemExibicao: (ultimo._max.ordemExibicao ?? 0) + 1 } })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function removerItem(ctx: Contexto, ordemId: string, versao: number, itemId: string): Promise<Totais> {
  return executarUmaVez(ctx, 'item.remover', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const { count } = await tx.itemOrdem.updateMany({
      where: { id: itemId, ordemId, empresaId: ctx.empresaId, ...VIVOS },
      data: { removidoEm: new Date(), removidoPorId: ctx.usuarioId },
    })
    if (count === 0) throw new ErroDeValidacao('item nao encontrado')
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function adicionarAcrescimo(ctx: Contexto, ordemId: string, versao: number, dados: DadosAcrescimo): Promise<Totais> {
  const valor = dinheiro(dados.valor)
  if (valor.lte(0)) throw new ErroDeValidacao('valor do acrescimo precisa ser maior que zero')
  return executarUmaVez(ctx, 'acrescimo.adicionar', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.acrescimoOrdem.create({
      data: { empresaId: ctx.empresaId, ordemId, tipo: dados.tipo, descricao: dados.descricao.trim().slice(0, 120), valor: paraBanco(valor) },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function removerAcrescimo(ctx: Contexto, ordemId: string, versao: number, acrescimoId: string): Promise<Totais> {
  return executarUmaVez(ctx, 'acrescimo.remover', async (tx) => {
    await carregarEditavel(tx, ctx, ordemId, versao)
    const { count } = await tx.acrescimoOrdem.updateMany({
      where: { id: acrescimoId, ordemId, empresaId: ctx.empresaId, ...VIVOS },
      data: { removidoEm: new Date(), removidoPorId: ctx.usuarioId },
    })
    if (count === 0) throw new ErroDeValidacao('acrescimo nao encontrado')
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** Ajuste manual: os quatro campos juntos. O recalculo em seguida respeita o preco final. */
export async function ajustarPreco(ctx: Contexto, ordemId: string, versao: number, precoFinal: string, motivo: string): Promise<Totais> {
  const preco = dinheiro(precoFinal)
  if (preco.lt(0)) throw new ErroDeValidacao('preco final nao pode ser negativo')
  if (motivo.trim() === '') throw new ErroDeValidacao('o motivo do ajuste e obrigatorio')
  return executarUmaVez(ctx, 'ordem.ajustar', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    const atual = await tx.ordemServico.findUniqueOrThrow({ where: { id: ordem.id }, select: { precoCalculado: true } })
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: {
        precoFinal: paraBanco(preco),
        motivoAjuste: motivo.trim().slice(0, 160),
        ajustadoPorId: ctx.usuarioId,
        ajustadoEm: new Date(),
        precoCalculadoNoAjuste: atual.precoCalculado,
      },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** "Manter o preco final": o ajuste passa a valer para o calculado atual. */
export async function confirmarAjuste(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.confirmar_ajuste', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    if (ordem.ajustadoPorId === null) throw new ErroDeValidacao('a ordem nao tem ajuste')
    const atual = await tx.ordemServico.findUniqueOrThrow({ where: { id: ordem.id }, select: { precoCalculado: true } })
    await tx.ordemServico.update({ where: { id: ordem.id }, data: { precoCalculadoNoAjuste: atual.precoCalculado } })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

/** "Usar o calculado": zera o ajuste; o recalculo faz preco_final seguir o calculado. */
export async function removerAjuste(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.remover_ajuste', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: { motivoAjuste: null, ajustadoPorId: null, ajustadoEm: null, precoCalculadoNoAjuste: null },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function atualizarCabecalho(ctx: Contexto, ordemId: string, versao: number, dados: DadosCabecalho): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.cabecalho', async (tx) => {
    const ordem = await carregar(tx, ctx, ordemId, versao)
    const soObservacoes = dados.clienteId === undefined && dados.prometidaPara === undefined && dados.responsavelId === undefined
    if (!editavel(ordem.estadoProducao) && !(soObservacoes && ordem.estadoProducao === 'concluida')) {
      throw new OrdemNaoEditavel(ordem.estadoProducao)
    }
    const snapshot = dados.clienteId === undefined ? {} : await snapshotCliente(tx, ctx.empresaId, dados.clienteId)
    let prometida: Date | null | undefined
    if (dados.prometidaPara !== undefined) {
      prometida = dados.prometidaPara ? lerDataCalendario(dados.prometidaPara) : null
      if (dados.prometidaPara && !prometida) throw new ErroDeValidacao('data prometida invalida')
    }
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: {
        ...snapshot,
        ...(prometida !== undefined ? { prometidaPara: prometida } : {}),
        ...(dados.responsavelId ? { responsavelId: dados.responsavelId } : {}),
        ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes?.trim() || null } : {}),
      },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function aprovarOrcamento(ctx: Contexto, ordemId: string, versao: number): Promise<Totais> {
  return executarUmaVez(ctx, 'ordem.aprovar', async (tx) => {
    const ordem = await carregar(tx, ctx, ordemId, versao)
    if (ordem.estadoProducao !== 'orcamento') throw new OrdemNaoEditavel(ordem.estadoProducao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: { estadoProducao: transicionar('orcamento', 'aberta'), aprovadoEm: new Date(), precoAprovado: ordem.precoFinal },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export async function cancelarOrdem(ctx: Contexto, ordemId: string, versao: number, motivo: string): Promise<Totais> {
  if (motivo.trim() === '') throw new ErroDeValidacao('o motivo do cancelamento e obrigatorio')
  return executarUmaVez(ctx, 'ordem.cancelar', async (tx) => {
    const ordem = await carregarEditavel(tx, ctx, ordemId, versao)
    await tx.ordemServico.update({
      where: { id: ordem.id },
      data: {
        estadoProducao: transicionar(ordem.estadoProducao, 'cancelada'),
        canceladaEm: new Date(),
        motivoCancelamento: motivo.trim().slice(0, 160),
      },
    })
    return recalcular(tx, ctx, ordemId, versao)
  })
}

export * from './tela'
