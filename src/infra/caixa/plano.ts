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
}

export async function listarContas(empresaId: string, opcoes: { incluirInativas?: boolean } = {}): Promise<ContaTela[]> {
  const [empresa, contas] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } }),
    prisma.contaPlano.findMany({
      where: { empresaId, ...(opcoes.incluirInativas ? {} : { ativa: true }) },
      orderBy: [{ grupo: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, nome: true, nivel: true, tipo: true, grupo: true, ativa: true },
    }),
  ])
  return contas.map((c) => ({ ...c, recebeVendas: c.id === empresa.contaRecebimentoId }))
}

/** Codigo = maior + 1, dentro da transacao. Nome unico por empresa sem diferenciar maiusculas. */
export async function criarConta(empresaId: string, dados: { nome: string; tipo: string; grupo: string }): Promise<{ id: string }> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ').slice(0, 80)
  const grupo = dados.grupo.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (nome === '') throw new ErroDeValidacao('informe o nome da conta')
  if (dados.tipo !== 'receita' && dados.tipo !== 'despesa') throw new ErroDeValidacao('tipo precisa ser receita ou despesa')
  if (grupo === '') throw new ErroDeValidacao('informe o grupo')
  const tipo: TipoConta = dados.tipo
  return prisma.$transaction(async (tx) => {
    const repetida = await tx.contaPlano.findFirst({ where: { empresaId, nome: { equals: nome, mode: 'insensitive' } }, select: { id: true } })
    if (repetida) throw new ErroDeValidacao('já existe conta com esse nome')
    const ultimo = await tx.contaPlano.aggregate({ where: { empresaId }, _max: { codigo: true } })
    return tx.contaPlano.create({ data: { empresaId, codigo: (ultimo._max.codigo ?? 0) + 1, nome, tipo, grupo }, select: { id: true } })
  })
}

export async function alterarAtiva(empresaId: string, contaId: string, ativa: boolean): Promise<void> {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } })
  if (!ativa && empresa.contaRecebimentoId === contaId) throw new ErroDeValidacao('esta conta recebe as vendas; escolha outra antes de desativar')
  const { count } = await prisma.contaPlano.updateMany({ where: { id: contaId, empresaId }, data: { ativa } })
  if (count === 0) throw new ErroDeValidacao('conta não encontrada')
}

export async function definirContaRecebimento(empresaId: string, contaId: string): Promise<void> {
  const conta = await prisma.contaPlano.findFirst({ where: { id: contaId, empresaId }, select: { tipo: true, ativa: true } })
  if (!conta) throw new ErroDeValidacao('conta não encontrada')
  if (conta.tipo !== 'receita') throw new ErroDeValidacao('a conta que recebe as vendas precisa ser de receita')
  if (!conta.ativa) throw new ErroDeValidacao('a conta está desativada')
  await prisma.empresa.update({ where: { id: empresaId }, data: { contaRecebimentoId: contaId } })
}
