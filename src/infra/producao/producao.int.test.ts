import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import { criarOrdem, adicionarItem, atualizarCabecalho, type DadosItem } from '@/infra/ordens/repositorio'
import { registrarRecebimento, concluirOrdem } from '@/infra/caixa/recebimentos'
import { carregarFilaProducao } from './fila'
import { carregarOperacao } from '@/infra/operacao/indicadores'
import { carregarCarteira } from '@/infra/clientes/carteira'

let base: Contexto
const ctx = () => ({ ...base, chave: randomUUID() })
const ITEM = (descricao: string, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade: 1, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const vendas = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' } })
  await prisma.empresa.update({ where: { id: empresa.id }, data: { contaRecebimentoId: vendas.id } })
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

async function ordemCom(valor: string, descricao = 'PLACA ACM') {
  const o = await criarOrdem(ctx(), { estado: 'aberta' })
  const t = await adicionarItem(ctx(), o.id, o.versao, ITEM(descricao, valor))
  return { id: o.id, numero: o.numero, versao: t.versao }
}

describe('fila de producao (banco real)', () => {
  it('agrupa por urgencia, traz os itens e nao devolve orcamento, concluida nem cancelada', async () => {
    const atrasada = await ordemCom('100.00', 'PLACA ATRASADA')
    await atualizarCabecalho(ctx(), atrasada.id, atrasada.versao, { prometidaPara: '2020-01-01' })
    const semData = await ordemCom('50.00', 'BANNER SEM DATA')
    const concluida = await ordemCom('80.00', 'JA PRONTA')
    await concluirOrdem(ctx(), concluida.id, concluida.versao)
    const orcamento = await criarOrdem(ctx(), { estado: 'orcamento' })

    const fila = await carregarFilaProducao(base.empresaId)
    expect(fila.grupos.map((g) => g.grupo)).toEqual(['atrasada', 'sem_data'])
    expect(fila.grupos[0]?.ordens[0]).toMatchObject({ id: atrasada.id, itens: ['PLACA ATRASADA'] })
    expect(fila.grupos[1]?.ordens.map((o) => o.id)).toEqual([semData.id])
    expect(fila.total).toBe(2)
    expect(fila.atrasadas).toBe(1)
    const ids = fila.grupos.flatMap((g) => g.ordens.map((o) => o.id))
    expect(ids).not.toContain(concluida.id)
    expect(ids).not.toContain(orcamento.id)
  })

  it('a versao que vem na fila serve para concluir; item removido nao aparece na descricao', async () => {
    const o = await ordemCom('100.00', 'PLACA A')
    const t = await adicionarItem(ctx(), o.id, o.versao, ITEM('PLACA B', '20.00'))
    const fila = await carregarFilaProducao(base.empresaId)
    const daFila = fila.grupos[0]?.ordens[0]
    expect(daFila?.itens).toEqual(['PLACA A', 'PLACA B'])
    expect(daFila?.versao).toBe(t.versao)
    const r = await concluirOrdem(ctx(), o.id, daFila?.versao ?? 0)
    expect(r.estadoProducao).toBe('concluida')
    expect((await carregarFilaProducao(base.empresaId)).total).toBe(0)
  })

  it('nao enxerga ordem de outra empresa', async () => {
    await ordemCom('100.00')
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    expect((await carregarFilaProducao(outra.id)).total).toBe(0)
  })
})

describe('indicadores de operacao (banco real)', () => {
  it('conta, mede o valor parado e o prazo, e separa por ano', async () => {
    const paga = await ordemCom('150.00')
    await registrarRecebimento(ctx(), paga.id, paga.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })
    const parada = await ordemCom('2528.00')
    const parcial = await ordemCom('300.00')
    const c = await concluirOrdem(ctx(), parcial.id, parcial.versao)
    await registrarRecebimento(ctx(), parcial.id, c.versao, { valor: '100', forma: 'dinheiro', data: '2026-08-29', concluir: false })

    const { indicadores, anos } = await carregarOperacao(base.empresaId)
    expect(indicadores).toMatchObject({ total: 3, abertas: 1, concluidas: 2, valorParado: '2728.00', faturado: '2978.00', recebido: '250.00', comItemPct: '100.0', pessoas: 1 })
    expect(indicadores.naoFinalizadasPct).toBe('33.3')
    expect(indicadores.prazoMedianoDias).toBe(0)
    expect(anos).toHaveLength(1)
    expect(anos[0]).toMatchObject({ ano: 2026, ordens: 3, concluidas: 2, faturado: '2978.00' })
    void parada
  })

  it('o periodo filtra por aberta_em no calendario de Sao Paulo; periodo invertido e recusado', async () => {
    const o = await ordemCom('100.00')
    await prisma.ordemServico.update({ where: { id: o.id }, data: { abertaEm: new Date('2026-07-15T15:00:00.000Z') } })
    expect((await carregarOperacao(base.empresaId, { de: '2026-07-01', ate: '2026-07-31' })).indicadores.total).toBe(1)
    expect((await carregarOperacao(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })).indicadores.total).toBe(0)
    await expect(carregarOperacao(base.empresaId, { de: '2026-08-31', ate: '2026-08-01' })).rejects.toThrow(/período/)
  })
})

describe('carteira de clientes (banco real)', () => {
  it('agrupa os cadastros do mesmo CNPJ, soma o faturado e classifica a recencia', async () => {
    const cnpj = '18008342000122'
    const saude = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'PREFEITURA - SAUDE', apelido: 'PMU SAUDE', documento: cnpj } })
    const cultura = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'PREFEITURA - CULTURA', apelido: 'PMU CULTURA', documento: cnpj } })
    const helio = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'HELIO DA SILVA MOTA' } })
    await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'NUNCA COMPROU' } })

    for (const [cliente, valor] of [[saude.id, '900.00'], [cultura.id, '100.00'], [helio.id, '500.00']] as const) {
      const o = await ordemCom(valor)
      await atualizarCabecalho(ctx(), o.id, o.versao, { clienteId: cliente })
    }

    const carteira = await carregarCarteira(base.empresaId)
    expect(carteira.grupos).toHaveLength(2)
    expect(carteira.grupos[0]).toMatchObject({ documento: cnpj, nome: 'PREFEITURA - SAUDE', cadastros: 2, ordens: 2, faturado: '1000.00', fatiaPct: '66.7', recencia: 'ativo' })
    expect(carteira.grupos[1]).toMatchObject({ nome: 'HELIO DA SILVA MOTA', cadastros: 1, faturado: '500.00' })
    expect(carteira.faturadoTotal).toBe('1500.00')
    expect(carteira.contagem).toEqual({ ativo: 2, adormecido: 0, perdido: 0 })
  })

  it('venda de balcao nao vira cliente, e cancelada nao conta faturamento', async () => {
    const cliente = await prisma.cliente.create({ data: { empresaId: base.empresaId, nome: 'ALGUEM' } })
    const boa = await ordemCom('100.00')
    await atualizarCabecalho(ctx(), boa.id, boa.versao, { clienteId: cliente.id })
    await ordemCom('999.00') // balcao, sem cliente
    const carteira = await carregarCarteira(base.empresaId)
    expect(carteira.grupos).toHaveLength(1)
    expect(carteira.faturadoTotal).toBe('100.00')
  })
})
