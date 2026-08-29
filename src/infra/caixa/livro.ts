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
    if (!conta) throw new ErroDeValidacao('conta não encontrada')
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
  if (motivoLimpo === '') throw new ErroDeValidacao('o motivo do estorno é obrigatório')
  return executarUmaVez(ctx, 'caixa.estornar', async (tx) => {
    const l = await tx.lancamentoCaixa.findFirst({ where: { id: lancamentoId, empresaId: ctx.empresaId }, select: { id: true, tipo: true, estornadoEm: true } })
    if (!l) throw new ErroDeValidacao('lançamento não encontrado')
    if (l.tipo === 'entrada') throw new ErroDeValidacao('entrada se estorna pelo recebimento, na ordem')
    if (l.estornadoEm) throw new ErroDeValidacao('lançamento já estornado')
    await tx.lancamentoCaixa.update({ where: { id: l.id }, data: { estornadoEm: new Date(), estornadoPorId: ctx.usuarioId, motivoEstorno: motivoLimpo } })
    return { id: l.id }
  })
}


export interface Livro {
  de: string
  ate: string
  linhas: LinhaLivro[]
  /** Somas dos lancamentos vivos, strings com 2 casas. */
  entradas: string
  saidas: string
  saldo: string
}

export async function listarLivro(empresaId: string, periodo: { de: string; ate: string }): Promise<Livro> {
  const de = lerDataCalendario(periodo.de)
  const ate = lerDataCalendario(periodo.ate)
  if (!de || !ate || de.getTime() > ate.getTime()) throw new ErroDeValidacao('período inválido')
  const lancamentos = await prisma.lancamentoCaixa.findMany({
    where: { empresaId, data: { gte: de, lte: ate } },
    orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
    include: { conta: { select: { codigo: true, nome: true } }, ordem: { select: { numero: true } }, usuario: { select: { nome: true } } },
  })
  let entradas = dinheiro(0)
  let saidas = dinheiro(0)
  const linhas = lancamentos.map((l) => {
    const valor = paraDominio(l.valor)
    if (!l.estornadoEm) {
      if (l.tipo === 'entrada') entradas = entradas.plus(valor)
      else saidas = saidas.plus(valor)
    }
    return {
      id: l.id, data: l.data.toISOString(), tipo: l.tipo, valor: valor.toFixed(2), contaCodigo: l.conta.codigo, contaNome: l.conta.nome,
      historico: l.historico, ordemId: l.ordemId, ordemNumero: l.ordem?.numero ?? null, fornecedor: l.fornecedor, parcela: l.parcela,
      totalParcelas: l.totalParcelas, usuarioNome: l.usuario.nome, estornadoEm: l.estornadoEm?.toISOString() ?? null, motivoEstorno: l.motivoEstorno,
    }
  })
  return { de: periodo.de, ate: periodo.ate, linhas, entradas: entradas.toFixed(2), saidas: saidas.toFixed(2), saldo: entradas.minus(saidas).toFixed(2) }
}
