import { prisma } from '@/infra/db/prisma'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { TipoConta } from '@/domain/caixa/lancamento'

export interface ContaTela {
  id: string
  codigo: number
  nome: string
  nivel: number
  tipo: TipoConta
  grupo: string
  ativa: boolean
  /** A conta em que todo recebimento cai. */
  recebeVendas: boolean
  /** Quantos lancamentos ja apontam para ela. Zero = da para excluir sem perder historico. */
  lancamentos: number
}

export async function listarContas(empresaId: string, opcoes: { incluirInativas?: boolean } = {}): Promise<ContaTela[]> {
  const [empresa, contas] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } }),
    prisma.contaPlano.findMany({
      where: { empresaId, ...(opcoes.incluirInativas ? {} : { ativa: true }) },
      // Receita antes de despesa (a ordem do enum): a tela le de cima para baixo
      // "o dinheiro entra aqui, sai por estas". Alfabetico jogava Receitas por ultimo.
      orderBy: [{ tipo: 'asc' }, { grupo: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, nome: true, nivel: true, tipo: true, grupo: true, ativa: true, _count: { select: { lancamentos: true } } },
    }),
  ])
  return contas.map(({ _count, ...c }) => ({ ...c, recebeVendas: c.id === empresa.contaRecebimentoId, lancamentos: _count.lancamentos }))
}

/** Codigo = maior + 1, dentro da transacao. Nome unico por empresa sem diferenciar maiusculas. */
export async function criarConta(empresaId: string, dados: { nome: string; tipo: string; grupo: string }): Promise<{ id: string }> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ').slice(0, 80)
  const grupo = dados.grupo.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (nome === '') throw new ErroDeValidacao('Informe o nome da conta.')
  if (dados.tipo !== 'receita' && dados.tipo !== 'despesa') throw new ErroDeValidacao('Escolha se a conta é de receita ou de despesa.')
  if (grupo === '') throw new ErroDeValidacao('Informe o grupo.')
  const tipo: TipoConta = dados.tipo
  return prisma.$transaction(async (tx) => {
    const repetida = await tx.contaPlano.findFirst({ where: { empresaId, nome: { equals: nome, mode: 'insensitive' } }, select: { id: true } })
    if (repetida) throw new ErroDeValidacao('Já existe uma conta com esse nome.')
    const ultimo = await tx.contaPlano.aggregate({ where: { empresaId }, _max: { codigo: true } })
    return tx.contaPlano.create({ data: { empresaId, codigo: (ultimo._max.codigo ?? 0) + 1, nome, tipo, grupo }, select: { id: true } })
  })
}

export async function alterarAtiva(empresaId: string, contaId: string, ativa: boolean): Promise<void> {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } })
  if (!ativa && empresa.contaRecebimentoId === contaId) throw new ErroDeValidacao('Esta conta recebe as vendas. Escolha outra antes de desativar.')
  const { count } = await prisma.contaPlano.updateMany({ where: { id: contaId, empresaId }, data: { ativa } })
  if (count === 0) throw new ErroDeValidacao('Conta não encontrada.')
}

/**
 * Exclui de vez -- so a conta que nunca foi usada.
 *
 * Desativar e excluir sao coisas diferentes, como em materiais: desativar tira
 * da lista de "Nova saida" e guarda o historico; excluir e para a conta criada
 * por engano. Conta com lancamento nunca some, senao o relatorio do contador
 * passaria a somar linhas orfas.
 */
export async function excluirConta(empresaId: string, contaId: string): Promise<void> {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } })
  if (empresa.contaRecebimentoId === contaId) throw new ErroDeValidacao('Esta conta recebe as vendas. Escolha outra antes de excluir.')
  const usos = await prisma.lancamentoCaixa.count({ where: { empresaId, contaId } })
  if (usos > 0) throw new ErroDeValidacao(`Esta conta já tem ${usos} lançamento${usos > 1 ? 's' : ''} no livro-caixa. Desative em vez de excluir.`)
  const { count } = await prisma.contaPlano.deleteMany({ where: { id: contaId, empresaId } })
  if (count === 0) throw new ErroDeValidacao('Conta não encontrada.')
}

export async function definirContaRecebimento(empresaId: string, contaId: string): Promise<void> {
  const conta = await prisma.contaPlano.findFirst({ where: { id: contaId, empresaId }, select: { tipo: true, ativa: true } })
  if (!conta) throw new ErroDeValidacao('Conta não encontrada.')
  if (conta.tipo !== 'receita') throw new ErroDeValidacao('A conta que recebe as vendas precisa ser de receita.')
  if (!conta.ativa) throw new ErroDeValidacao('Esta conta está desativada.')
  await prisma.empresa.update({ where: { id: empresaId }, data: { contaRecebimentoId: contaId } })
}
