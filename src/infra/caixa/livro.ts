import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { prisma } from '@/infra/db/prisma'
import { executarUmaVez, type Contexto } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { validarSaida, type LinhaLivro } from '@/domain/caixa/lancamento'
export type { LinhaLivro }
import { lerDataCalendario } from '@/domain/ordem/datas'

export interface DadosSaida {
  valor: string
  data: string
  historico: string
  contaId: string
  fornecedor: string
  parcela: string
  totalParcelas: string
}

export async function registrarSaida(ctx: Contexto, dados: DadosSaida): Promise<{ id: string }> {
  return executarUmaVez(ctx, 'caixa.saida', async (tx) => {
    const conta = await tx.contaPlano.findFirst({ where: { id: dados.contaId, empresaId: ctx.empresaId }, select: { id: true, tipo: true, ativa: true } })
    if (!conta) throw new ErroDeValidacao('Conta não encontrada.')
    const s = validarSaida(dados, conta)
    return tx.lancamentoCaixa.create({
      data: {
        empresaId: ctx.empresaId, data: s.data, tipo: 'saida', valor: paraBanco(s.valor), contaId: conta.id, historico: s.historico,
        fornecedor: dados.fornecedor.trim().slice(0, 120) || null, parcela: s.parcela, totalParcelas: s.totalParcelas, usuarioId: ctx.usuarioId,
      },
      select: { id: true },
    })
  })
}

/** So saida: a entrada se estorna pelo recebimento, na ordem, para os dois andarem juntos. */
export async function estornarLancamento(ctx: Contexto, lancamentoId: string, motivo: string): Promise<{ id: string }> {
  const motivoLimpo = motivo.trim().slice(0, 160)
  if (motivoLimpo === '') throw new ErroDeValidacao('Informe o motivo do estorno.')
  return executarUmaVez(ctx, 'caixa.estornar', async (tx) => {
    const l = await tx.lancamentoCaixa.findFirst({ where: { id: lancamentoId, empresaId: ctx.empresaId }, select: { id: true, tipo: true, estornadoEm: true } })
    if (!l) throw new ErroDeValidacao('Lançamento não encontrado.')
    if (l.tipo === 'entrada') throw new ErroDeValidacao('Entrada de caixa se estorna pelo recebimento, dentro da ordem.')
    if (l.estornadoEm) throw new ErroDeValidacao('Este lançamento já foi estornado.')
    await tx.lancamentoCaixa.update({ where: { id: l.id }, data: { estornadoEm: new Date(), estornadoPorId: ctx.usuarioId, motivoEstorno: motivoLimpo } })
    return { id: l.id }
  })
}


export interface Livro {
  de: string
  ate: string
  linhas: LinhaLivro[]
  /** Quantos lancamentos o periodo tem, mesmo quando a pagina mostra menos. */
  total: number
  /** Somas dos lancamentos vivos, strings com 2 casas. */
  entradas: string
  saidas: string
  saldo: string
}

export interface FiltrosLivro {
  limite?: number
  pagina?: number
  ordem?: 'asc' | 'desc'
  /** 'entrada' ou 'saida'; qualquer outra coisa vale como "os dois". */
  tipo?: string
  /** Uma conta do plano. Vem da tela, entao entra como igualdade e nao como texto livre. */
  contaId?: string
  /** Procura no historico e no fornecedor. */
  q?: string
}

export async function listarLivro(
  empresaId: string,
  periodo: { de: string; ate: string },
  filtros: FiltrosLivro = {},
): Promise<Livro> {
  const de = lerDataCalendario(periodo.de)
  const ate = lerDataCalendario(periodo.ate)
  if (!de || !ate || de.getTime() > ate.getTime()) throw new ErroDeValidacao('Período inválido.')
  const q = filtros.q?.trim() ?? ''
  const onde = {
    empresaId,
    data: { gte: de, lte: ate },
    ...(filtros.tipo === 'entrada' ? { tipo: 'entrada' as const } : {}),
    ...(filtros.tipo === 'saida' ? { tipo: 'saida' as const } : {}),
    ...(filtros.contaId ? { contaId: filtros.contaId } : {}),
    ...(q === ''
      ? {}
      : {
          OR: [
            { historico: { contains: q, mode: 'insensitive' as const } },
            { fornecedor: { contains: q, mode: 'insensitive' as const } },
          ],
        }),
  }
  const paginacao = filtros
  const limite = paginacao.limite

  /*
   * As somas vem de agregado sobre o periodo INTEIRO, nao da pagina.
   * Antes o livro carregava todo lancamento do mes e somava em memoria: com o
   * sistema em producao, um mes movimentado sao centenas de linhas renderizadas
   * de uma vez. Paginando as linhas mas somando na pagina, os totais mentiriam
   * -- "entradas do mes" viraria "entradas destas cinquenta linhas".
   */
  const [somas, total, lancamentos] = await Promise.all([
    prisma.lancamentoCaixa.groupBy({
      by: ['tipo'],
      where: { ...onde, estornadoEm: null },
      _sum: { valor: true },
    }),
    prisma.lancamentoCaixa.count({ where: onde }),
    prisma.lancamentoCaixa.findMany({
      where: onde,
      /*
       * O padrao continua cronologico crescente, que e como um livro-caixa se le
       * de ponta a ponta e e o que o relatorio do contador consome. A TELA pede
       * 'desc': paginando em ordem crescente, o lancamento de hoje cai na ultima
       * pagina, e quem abre o livro quer ver o que acabou de acontecer, nao o
       * dia 1 do mes.
       */
      orderBy: paginacao.ordem === 'desc'
        ? [{ data: 'desc' }, { criadoEm: 'desc' }]
        : [{ data: 'asc' }, { criadoEm: 'asc' }],
      ...(limite ? { take: limite, skip: paginacao.pagina && paginacao.pagina > 1 ? (paginacao.pagina - 1) * limite : 0 } : {}),
      include: { conta: { select: { codigo: true, nome: true } }, ordem: { select: { numero: true } }, usuario: { select: { nome: true } } },
    }),
  ])
  const soma = (t: 'entrada' | 'saida') => {
    const v = somas.find((g) => g.tipo === t)?._sum.valor
    return v === null || v === undefined ? dinheiro(0) : paraDominio(v)
  }
  const entradas = soma('entrada')
  const saidas = soma('saida')

  const linhas = lancamentos.map((l) => {
    const valor = paraDominio(l.valor)
    return {
      id: l.id, data: l.data.toISOString(), tipo: l.tipo, valor: valor.toFixed(2), contaCodigo: l.conta.codigo, contaNome: l.conta.nome,
      historico: l.historico, ordemId: l.ordemId, ordemNumero: l.ordem?.numero ?? null, fornecedor: l.fornecedor, parcela: l.parcela,
      totalParcelas: l.totalParcelas, usuarioNome: l.usuario.nome, estornadoEm: l.estornadoEm?.toISOString() ?? null, motivoEstorno: l.motivoEstorno,
    }
  })
  return {
    de: periodo.de, ate: periodo.ate, linhas, total,
    entradas: entradas.toFixed(2), saidas: saidas.toFixed(2), saldo: entradas.minus(saidas).toFixed(2),
  }
}
