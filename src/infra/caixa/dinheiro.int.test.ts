import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import { criarOrdem, adicionarItem, obterOrdemParaTela, listarOrdens, ConflitoVersao, OrdemNaoEditavel, type DadosItem } from '@/infra/ordens/repositorio'
import { registrarRecebimento, concluirOrdem, estornarRecebimento } from './recebimentos'
import { registrarSaida, estornarLancamento, listarLivro } from './livro'
import { listarContas, criarConta, alterarAtiva, definirContaRecebimento } from './plano'
import { carregarFila } from './fila'

let base: Contexto
let contaVendas = ''
let contaAgua = ''
const ctx = () => ({ ...base, chave: randomUUID() })
const ITEM = (descricao: string, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade: 1, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const vendas = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' } })
  const agua = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 3, nome: 'AGUA', nivel: 2, tipo: 'despesa', grupo: 'CUSTO GERAL' } })
  await prisma.empresa.update({ where: { id: empresa.id }, data: { contaRecebimentoId: vendas.id } })
  contaVendas = vendas.id
  contaAgua = agua.id
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

async function ordemComItem(valor: string, estado: 'aberta' | 'orcamento' = 'aberta') {
  const ordem = await criarOrdem(ctx(), { estado })
  const t = await adicionarItem(ctx(), ordem.id, ordem.versao, ITEM('placa', valor))
  return { id: ordem.id, numero: ordem.numero, versao: t.versao }
}

describe('concluir e receber (banco real)', () => {
  it('grava os tres registros numa transacao: ordem concluida, recebimento e lancamento de entrada', async () => {
    const o = await ordemComItem('150.00')
    const r = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '150,00', forma: 'pix', data: '2026-08-29', concluir: true })
    expect(r).toEqual({ versao: o.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'pago', totalRecebido: '150.00', saldo: '0.00' })

    const ordem = await prisma.ordemServico.findUniqueOrThrow({ where: { id: o.id }, include: { recebimentos: { include: { lancamento: true } } } })
    expect(ordem.estadoProducao).toBe('concluida')
    expect(ordem.concluidaEm).not.toBeNull()
    expect(ordem.concluidaPorId).toBe(base.usuarioId)
    expect(ordem.recebimentos).toHaveLength(1)
    const rec = ordem.recebimentos[0]!
    expect(rec).toMatchObject({ forma: 'pix', usuarioId: base.usuarioId, estornadoEm: null })
    expect(rec.valor.toFixed(2)).toBe('150.00')
    expect(rec.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
    expect(rec.lancamento).toMatchObject({ tipo: 'entrada', contaId: contaVendas, ordemId: o.id, historico: `OS 0${o.numero} · Venda de balcão · Pix` })
    expect(rec.lancamento.valor.toFixed(2)).toBe('150.00')

    const tela = await obterOrdemParaTela(base.empresaId, o.id)
    expect(tela?.pagamento).toEqual({ estado: 'pago', totalRecebido: '150.00', saldo: '0.00' })
    expect(tela?.recebimentos.map((x) => [x.forma, x.valor, x.usuario])).toEqual([['pix', '150.00', 'Odete Silva']])
    expect(tela?.concluidaEm).not.toBeNull()
  })

  it('ou nada: dois recebimentos com a mesma versao — um grava os tres registros, o outro desfaz tudo', async () => {
    const o = await ordemComItem('150.00')
    const dados = { valor: '150,00', forma: 'dinheiro', data: '2026-08-29', concluir: true }
    const resultados = await Promise.allSettled([
      registrarRecebimento(ctx(), o.id, o.versao, dados),
      registrarRecebimento(ctx(), o.id, o.versao, dados),
    ])
    const ok = resultados.filter((r) => r.status === 'fulfilled')
    const falhou = resultados.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(falhou).toHaveLength(1)
    expect((falhou[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflitoVersao)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1)
    expect(await prisma.lancamentoCaixa.count({ where: { ordemId: o.id } })).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: base.empresaId, acao: 'recebimento.registrar' } })).toBe(1) // a chave do perdedor foi desfeita junto
  })

  it('sem conta de recebimento na empresa, nada e gravado e a mensagem explica', async () => {
    await prisma.empresa.update({ where: { id: base.empresaId }, data: { contaRecebimentoId: null } })
    const o = await ordemComItem('150.00')
    await expect(registrarRecebimento(ctx(), o.id, o.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })).rejects.toThrow(/conta que recebe as vendas/i)
    const ordem = await prisma.ordemServico.findUniqueOrThrow({ where: { id: o.id } })
    expect(ordem.estadoProducao).toBe('aberta')
    expect(ordem.versao).toBe(o.versao)
    expect(await prisma.recebimento.count()).toBe(0)
    expect(await prisma.lancamentoCaixa.count()).toBe(0)
  })

  it('parcial: 80 de 200 fica parcial, 120 completa; acima do saldo e recusado', async () => {
    const o = await ordemComItem('200.00')
    const r1 = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '80', forma: 'dinheiro', data: '2026-08-29', concluir: false })
    expect(r1).toMatchObject({ estadoProducao: 'aberta', estadoPagamento: 'parcial', totalRecebido: '80.00', saldo: '120.00' })
    await expect(registrarRecebimento(ctx(), o.id, r1.versao, { valor: '120,02', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(/saldo a receber \(R\$ 120,00\)/)
    const r2 = await registrarRecebimento(ctx(), o.id, r1.versao, { valor: '120', forma: 'pix', data: '2026-08-30', concluir: true })
    expect(r2).toMatchObject({ estadoProducao: 'concluida', estadoPagamento: 'pago', totalRecebido: '200.00', saldo: '0.00' })
    await expect(registrarRecebimento(ctx(), o.id, r2.versao, { valor: '1', forma: 'pix', data: '2026-08-30', concluir: false })).rejects.toThrow(/já está paga/)
  })

  it('idempotente: a mesma chave duas vezes grava um recebimento e devolve a mesma resposta', async () => {
    const o = await ordemComItem('150.00')
    const c = ctx()
    const dados = { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true }
    const a = await registrarRecebimento(c, o.id, o.versao, dados)
    const b = await registrarRecebimento(c, o.id, o.versao, dados)
    expect(b).toEqual(a)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1)
  })

  it('trava otimista, orcamento e cancelada', async () => {
    const o = await ordemComItem('150.00')
    await expect(registrarRecebimento(ctx(), o.id, o.versao - 1, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(ConflitoVersao)
    const orc = await ordemComItem('90.00', 'orcamento')
    await expect(registrarRecebimento(ctx(), orc.id, orc.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(/aprove o orçamento/i)
    await expect(registrarRecebimento(ctx(), orc.id, orc.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: true })).rejects.toThrow(OrdemNaoEditavel)
  })

  it('servico finalizado nao toca em dinheiro; concluir duas vezes e recusado', async () => {
    const o = await ordemComItem('150.00')
    const r = await concluirOrdem(ctx(), o.id, o.versao)
    expect(r).toEqual({ versao: o.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'nao_pago', totalRecebido: '0.00', saldo: '150.00' })
    expect(await prisma.lancamentoCaixa.count()).toBe(0)
    await expect(concluirOrdem(ctx(), o.id, r.versao)).rejects.toThrow(OrdemNaoEditavel)
    const r2 = await registrarRecebimento(ctx(), o.id, r.versao, { valor: '150', forma: 'cheque', data: '2026-08-29', concluir: false })
    expect(r2.estadoPagamento).toBe('pago')
  })

  it('estorno marca recebimento e lancamento, exige motivo, e o eixo volta a nao pago', async () => {
    const o = await ordemComItem('150.00')
    const r = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })
    const rec = await prisma.recebimento.findFirstOrThrow({ where: { ordemId: o.id } })
    await expect(estornarRecebimento(ctx(), o.id, r.versao, rec.id, '  ')).rejects.toThrow(/motivo/i)
    const e = await estornarRecebimento(ctx(), o.id, r.versao, rec.id, 'valor digitado errado')
    expect(e).toMatchObject({ versao: r.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'nao_pago', totalRecebido: '0.00', saldo: '150.00' })
    const depois = await prisma.recebimento.findUniqueOrThrow({ where: { id: rec.id }, include: { lancamento: true } })
    expect(depois).toMatchObject({ motivoEstorno: 'valor digitado errado', estornadoPorId: base.usuarioId })
    expect(depois.estornadoEm).not.toBeNull()
    expect(depois.lancamento.estornadoEm).not.toBeNull()
    expect(depois.lancamento.motivoEstorno).toBe('valor digitado errado')
    await expect(estornarRecebimento(ctx(), o.id, e.versao, rec.id, 'de novo')).rejects.toThrow(/já (foi )?estornado/i)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1) // nada apagado
  })

  it('a ordem de outra empresa nao e vista', async () => {
    const o = await ordemComItem('150.00')
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    await expect(registrarRecebimento({ ...ctx(), empresaId: outra.id }, o.id, o.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow('ordem nao encontrada')
  })
})

describe('livro-caixa e plano (banco real)', () => {
  it('saida com parcela, entradas dos recebimentos, totais do periodo e estorno riscado', async () => {
    const o = await ordemComItem('300.00')
    await registrarRecebimento(ctx(), o.id, o.versao, { valor: '300', forma: 'pix', data: '2026-08-10', concluir: true })
    const s = await registrarSaida(ctx(), { valor: '45,90', data: '2026-08-12', historico: 'Conta de agua', contaId: contaAgua, fornecedor: 'COPASA', parcela: '2', totalParcelas: '3' })
    await registrarSaida(ctx(), { valor: '10', data: '2026-09-01', historico: 'Fora do periodo', contaId: contaAgua, fornecedor: '', parcela: '', totalParcelas: '' })

    const livro = await listarLivro(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })
    expect(livro.linhas.map((l) => [l.tipo, l.valor, l.historico, l.contaNome, l.ordemNumero, l.fornecedor, l.parcela, l.totalParcelas, l.usuarioNome])).toEqual([
      ['entrada', '300.00', `OS 0${o.numero} · Venda de balcão · Pix`, 'VENDAS DIVERSAS', o.numero, null, null, null, 'Odete Silva'],
      ['saida', '45.90', 'Conta de agua', 'AGUA', null, 'COPASA', 2, 3, 'Odete Silva'],
    ])
    expect(livro).toMatchObject({ entradas: '300.00', saidas: '45.90', saldo: '254.10' })

    await expect(estornarLancamento(ctx(), s.id, '')).rejects.toThrow(/motivo/i)
    await estornarLancamento(ctx(), s.id, 'lancado em duplicidade')
    const depois = await listarLivro(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })
    expect(depois.linhas[1]).toMatchObject({ estornadoEm: expect.any(String), motivoEstorno: 'lancado em duplicidade' })
    expect(depois).toMatchObject({ entradas: '300.00', saidas: '0.00', saldo: '300.00' })

    const entrada = depois.linhas[0]!
    await expect(estornarLancamento(ctx(), entrada.id, 'x')).rejects.toThrow(/pelo recebimento/i)
  })

  it('saida recusa conta de receita, conta de outra empresa e periodo invertido', async () => {
    await expect(registrarSaida(ctx(), { valor: '10', data: '2026-08-12', historico: 'x', contaId: contaVendas, fornecedor: '', parcela: '', totalParcelas: '' })).rejects.toThrow(/conta de despesa/)
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const alheia = await prisma.contaPlano.create({ data: { empresaId: outra.id, codigo: 1, nome: 'LUZ', tipo: 'despesa', grupo: 'G' } })
    await expect(registrarSaida(ctx(), { valor: '10', data: '2026-08-12', historico: 'x', contaId: alheia.id, fornecedor: '', parcela: '', totalParcelas: '' })).rejects.toThrow(/conta não encontrada/i)
    await expect(listarLivro(base.empresaId, { de: '2026-08-31', ate: '2026-08-01' })).rejects.toThrow(/período/i)
  })

  it('plano: lista por grupo, cria com o proximo codigo, recusa nome repetido, desativa e troca a conta de vendas', async () => {
    const antes = await listarContas(base.empresaId)
    expect(antes.map((c) => [c.grupo, c.codigo, c.recebeVendas])).toEqual([['CUSTO GERAL', 3, false], ['RECEITA GERAL', 1, true]])
    const nova = await criarConta(base.empresaId, { nome: '  Marketing digital ', tipo: 'despesa', grupo: 'DESPESAS' })
    expect(await prisma.contaPlano.findUniqueOrThrow({ where: { id: nova.id } })).toMatchObject({ codigo: 4, nome: 'Marketing digital', tipo: 'despesa', grupo: 'DESPESAS', ativa: true })
    await expect(criarConta(base.empresaId, { nome: 'marketing DIGITAL', tipo: 'despesa', grupo: 'DESPESAS' })).rejects.toThrow(/já existe/i)
    await expect(criarConta(base.empresaId, { nome: 'X', tipo: 'lucro', grupo: 'DESPESAS' })).rejects.toThrow(/receita ou de despesa/i)
    await expect(criarConta(base.empresaId, { nome: '', tipo: 'despesa', grupo: 'DESPESAS' })).rejects.toThrow(/nome/)

    await alterarAtiva(base.empresaId, nova.id, false)
    expect((await listarContas(base.empresaId)).map((c) => c.codigo)).toEqual([3, 1])
    expect((await listarContas(base.empresaId, { incluirInativas: true })).map((c) => c.codigo)).toEqual([3, 4, 1])
    await expect(alterarAtiva(base.empresaId, contaVendas, false)).rejects.toThrow(/recebe as vendas/)

    await expect(definirContaRecebimento(base.empresaId, contaAgua)).rejects.toThrow(/receita/)
    const deposito = await criarConta(base.empresaId, { nome: 'DEPOSITO', tipo: 'receita', grupo: 'RECEITA GERAL' })
    await definirContaRecebimento(base.empresaId, deposito.id)
    expect((await listarContas(base.empresaId)).find((c) => c.recebeVendas)?.nome).toBe('DEPOSITO')
  })
})

describe('fila e lista (banco real)', () => {
  it('fila: aberta ha 8 dias e parada; concluida nao paga esta a cobrar com o saldo; paga e recente ficam fora', async () => {
    const velha = await ordemComItem('100.00')
    await prisma.ordemServico.update({ where: { id: velha.id }, data: { abertaEm: new Date(Date.now() - 8 * 86_400_000) } })
    const recente = await ordemComItem('100.00')
    const cobrar = await ordemComItem('300.00')
    const c1 = await concluirOrdem(ctx(), cobrar.id, cobrar.versao)
    await registrarRecebimento(ctx(), cobrar.id, c1.versao, { valor: '100', forma: 'pix', data: '2026-08-29', concluir: false })
    const paga = await ordemComItem('50.00')
    await registrarRecebimento(ctx(), paga.id, paga.versao, { valor: '50', forma: 'pix', data: '2026-08-29', concluir: true })

    const fila = await carregarFila(base.empresaId)
    expect(fila.paradas.map((o) => o.id)).toEqual([velha.id])
    expect(fila.aCobrar.map((o) => [o.id, o.saldo])).toEqual([[cobrar.id, '200.00']])
    expect(fila.totalACobrar).toBe('200.00')
    expect(fila.paradas.find((o) => o.id === recente.id)).toBeUndefined()
  })

  it('listarOrdens mostra os dois eixos e filtra por numero, nome, estado e periodo', async () => {
    const a = await ordemComItem('100.00')
    const b = await ordemComItem('200.00')
    await registrarRecebimento(ctx(), b.id, b.versao, { valor: '50', forma: 'pix', data: '2026-08-29', concluir: true })
    await prisma.ordemServico.update({ where: { id: a.id }, data: { clienteNome: 'Prefeitura de Unaí', clienteApelido: 'PMU', abertaEm: new Date('2026-07-15T15:00:00.000Z') } })

    const todas = await listarOrdens(base.empresaId)
    expect(todas.map((o) => [o.id, o.estadoProducao, o.estadoPagamento, o.saldo])).toEqual([[b.id, 'concluida', 'parcial', '150.00'], [a.id, 'aberta', 'nao_pago', '100.00']])
    expect((await listarOrdens(base.empresaId, { q: String(a.numero) })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { q: 'pmu' })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { q: 'unaí' })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { estado: 'concluida' })).map((o) => o.id)).toEqual([b.id])
    expect((await listarOrdens(base.empresaId, { de: '2026-07-01', ate: '2026-07-31' })).map((o) => o.id)).toEqual([a.id])
    expect(await listarOrdens(base.empresaId, { de: '2026-07-31', ate: '2026-07-01' })).toEqual([])
  })
})
