import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { resolverLinha } from '@/domain/precificacao/resolucao'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import {
  criarOrdem, adicionarItem, removerItem, adicionarAcrescimo, removerAcrescimo, ajustarPreco, confirmarAjuste,
  removerAjuste, atualizarCabecalho, aprovarOrcamento, cancelarOrdem, obterOrdemParaTela, listarOrdens,
  ConflitoVersao, OrdemNaoEditavel, type DadosItem,
} from './repositorio'
import { obterImpresso } from './impresso'

let base: Contexto
let clienteId = ''
const ctx = () => ({ ...base, chave: randomUUID() })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const cliente = await prisma.cliente.create({
    data: {
      empresaId: empresa.id, nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ',
      telefones: { create: [{ empresaId: empresa.id, original: '(38)9874-3013', normalizado: '38998743013', inferido: true, ordem: 0 }] },
    },
  })
  clienteId = cliente.id
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

/** As seis linhas da OS 18449 exatamente como estao no legado. */
const LINHAS_18449 = [
  ['06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00', '723.00'],
  ['01 PLACA ACM 50 X 50 E ADES/ IMP  62,00', '62.00'],
  ['03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00', '228.00'],
  ['12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00', '732.00'],
  ['06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00', '558.00'],
  ['03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00', '225.00'],
] as const

function dadosDaLinha(texto: string): DadosItem {
  const r = resolverLinha(texto, [])
  if (r.tipo !== 'item' || r.valorUnitario === undefined) throw new Error('linha invalida')
  return {
    descricao: r.descricao, materialId: null, quantidade: r.quantidade,
    altura: r.altura?.toFixed(4) ?? null, largura: r.largura?.toFixed(4) ?? null,
    unidadeCobranca: r.unidade, valorUnitario: r.valorUnitario.toFixed(2),
  }
}

const UNIDADE = (descricao: string, quantidade: number, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

describe('ordem de servico (banco real)', () => {
  it('reproduz a OS 18449: seis itens por unidade somando 2.528,00, como OS 18461', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta', clienteId })
    expect(ordem.numero).toBe(18461)

    let versao = ordem.versao
    for (const [linha] of LINHAS_18449) {
      versao = (await adicionarItem(ctx(), ordem.id, versao, dadosDaLinha(linha))).versao
    }

    const tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.itens.map((i) => i.total)).toEqual(LINHAS_18449.map(([, t]) => t))
    expect(tela?.itens[3]).toMatchObject({ quantidade: 12, descricao: 'PLACAS ACM E ADES/ IMP', altura: '0.6100', largura: '0.4000', unidadeCobranca: 'unidade' })
    expect(tela?.subtotalItens).toBe('2528.00')
    expect(tela?.precoCalculado).toBe('2528.00')
    expect(tela?.precoFinal).toBe('2528.00')
    expect(tela?.versao).toBe(7)
    expect(tela?.cliente).toEqual({ id: clienteId, nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ', telefone: '(38)9874-3013' })
  })

  it('numera em sequencia por empresa, sem pular, e o snapshot do cliente vem na criacao', async () => {
    const a = await criarOrdem(ctx(), { estado: 'orcamento' })
    const b = await criarOrdem(ctx(), { estado: 'aberta', clienteId })
    expect([a.numero, b.numero]).toEqual([18461, 18462])
    const gravada = await prisma.ordemServico.findUniqueOrThrow({ where: { id: b.id } })
    expect(gravada).toMatchObject({ clienteNome: 'Sandra Hofig de Barros', clienteApelido: 'Fazenda HJ', clienteTelefone: '(38)9874-3013', estadoProducao: 'aberta' })
    expect((await listarOrdens(base.empresaId)).map((o) => o.numero)).toEqual([18462, 18461])
  })

  it('a mesma chave nao duplica o item e devolve o mesmo resultado', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const c = ctx()
    const r1 = await adicionarItem(c, ordem.id, ordem.versao, UNIDADE('PLACA ACM', 1, '62.00'))
    const r2 = await adicionarItem(c, ordem.id, ordem.versao, UNIDADE('PLACA ACM', 1, '62.00'))
    expect(r2).toEqual(r1)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(1)
  })

  it('versao velha recebe conflito e nada e gravado', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '10.00'))
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('B', 1, '10.00'))).rejects.toBeInstanceOf(ConflitoVersao)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: base.empresaId, acao: 'item.adicionar' } })).toBe(1)
  })

  it('as tres formas de cobranca na mesma ordem, mais acrescimos: a OS do artboard', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = ordem.versao
    v = (await adicionarItem(ctx(), ordem.id, v, { descricao: 'Placa ACM 3 mm', materialId: null, quantidade: 6, altura: '0.6', largura: '0.8', unidadeCobranca: 'm2', valorUnitario: '120.50' })).versao
    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('Letra caixa PVC', 18, '34.00'))).versao
    v = (await adicionarItem(ctx(), ordem.id, v, { descricao: 'Perfil de aluminio', materialId: null, quantidade: 1, altura: '0.61', largura: '0.6', unidadeCobranca: 'metro_linear', valorUnitario: '28.00' })).versao
    v = (await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'instalacao', descricao: '', valor: '280.00' })).versao
    const r = await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'deslocamento', descricao: '34 km', valor: '102.00' })
    // 347,04 + 612,00 + 67,76 = 1.026,80; + 382,00 = 1.408,80
    expect(r).toMatchObject({ subtotalItens: '1026.80', subtotalAcrescimos: '382.00', precoCalculado: '1408.80', precoFinal: '1408.80' })
  })

  it('remover item e acrescimo e soft: a linha fica, sai do preco e da tela', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '10.00'))).versao
    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '5.00'))).versao
    v = (await adicionarAcrescimo(ctx(), ordem.id, v, { tipo: 'frete', descricao: '', valor: '3.00' })).versao
    const tela1 = await obterOrdemParaTela(base.empresaId, ordem.id)
    const itemA = tela1!.itens.find((i) => i.descricao === 'A')!
    const frete = tela1!.acrescimos[0]!

    v = (await removerItem(ctx(), ordem.id, v, itemA.id)).versao
    const r = await removerAcrescimo(ctx(), ordem.id, v, frete.id)
    expect(r.precoCalculado).toBe('5.00')
    const tela2 = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela2?.itens.map((i) => i.descricao)).toEqual(['B'])
    expect(tela2?.acrescimos).toEqual([])
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(2)
    expect((await prisma.itemOrdem.findUniqueOrThrow({ where: { id: itemA.id } })).removidoPorId).toBe(base.usuarioId)
  })

  it('ajuste manual: preco final fica, o calculado segue os itens e a divergencia e persistida', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 2, '1000.00'))).versao
    const r1 = await ajustarPreco(ctx(), ordem.id, v, '1950.00', 'arredondamento comercial')
    expect(r1).toMatchObject({ precoCalculado: '2000.00', precoFinal: '1950.00' })
    v = r1.versao

    const r2 = await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '100.00'))
    expect(r2).toMatchObject({ precoCalculado: '2100.00', precoFinal: '1950.00' })
    let tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.ajuste).toMatchObject({ motivo: 'arredondamento comercial', por: 'Odete Silva', precoCalculadoNoAjuste: '2000.00', desatualizado: true })

    v = (await confirmarAjuste(ctx(), ordem.id, r2.versao)).versao
    tela = await obterOrdemParaTela(base.empresaId, ordem.id)
    expect(tela?.ajuste?.desatualizado).toBe(false)
    expect(tela?.precoFinal).toBe('1950.00')

    const r3 = await removerAjuste(ctx(), ordem.id, v)
    expect(r3.precoFinal).toBe('2100.00')
    expect((await obterOrdemParaTela(base.empresaId, ordem.id))?.ajuste).toBeNull()
  })

  it('ajuste negativo e motivo vazio sao recusados', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(ajustarPreco(ctx(), ordem.id, ordem.versao, '-1', 'x')).rejects.toThrow(/negativo/)
    await expect(ajustarPreco(ctx(), ordem.id, ordem.versao, '10', '  ')).rejects.toThrow(/motivo/)
  })

  it('cabecalho: troca de cliente refaz o snapshot; balcao limpa', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const r = await atualizarCabecalho(ctx(), ordem.id, ordem.versao, { clienteId, prometidaPara: '2026-09-04', observacoes: 'entregar na fazenda' })
    let g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g).toMatchObject({ clienteNome: 'Sandra Hofig de Barros', observacoes: 'entregar na fazenda', versao: r.versao })
    expect(g.prometidaPara?.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    await atualizarCabecalho(ctx(), ordem.id, r.versao, { clienteId: null })
    g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g.clienteId).toBeNull()
    expect(g.clienteNome).toBeNull()
  })

  it('aprovar orcamento guarda o preco aprovado; itens continuam editaveis; cancelar preserva tudo', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'orcamento' })
    let v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('A', 1, '90.00'))).versao
    v = (await aprovarOrcamento(ctx(), ordem.id, v)).versao
    let g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g.estadoProducao).toBe('aberta')
    expect(paraDominio(g.precoAprovado!).toFixed(2)).toBe('90.00')
    expect(g.aprovadoEm).not.toBeNull()
    await expect(aprovarOrcamento(ctx(), ordem.id, v)).rejects.toBeInstanceOf(OrdemNaoEditavel)

    v = (await adicionarItem(ctx(), ordem.id, v, UNIDADE('B', 1, '10.00'))).versao
    v = (await cancelarOrdem(ctx(), ordem.id, v, 'cliente desistiu')).versao
    g = await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })
    expect(g).toMatchObject({ estadoProducao: 'cancelada', motivoCancelamento: 'cliente desistiu' })
    expect(paraDominio(g.precoFinal).toFixed(2)).toBe('100.00')
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id, removidoEm: null } })).toBe(2)
    await expect(adicionarItem(ctx(), ordem.id, v, UNIDADE('C', 1, '1.00'))).rejects.toBeInstanceOf(OrdemNaoEditavel)
  })

  it('item invalido e recusado pelo dominio antes de gravar', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, { ...UNIDADE('A', 0, '1.00') })).rejects.toThrow(/quantidade/)
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, { ...UNIDADE('A', 1, '1.00'), unidadeCobranca: 'm2' })).rejects.toThrow(/altura e largura/i)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(0)
  })

  it('nao enxerga ordem de outra empresa', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    await expect(adicionarItem({ ...ctx(), empresaId: outra.id }, ordem.id, ordem.versao, UNIDADE('X', 1, '1.00'))).rejects.toThrow('ordem nao encontrada')
    expect(await obterOrdemParaTela(outra.id, ordem.id)).toBeNull()
  })
})

/**
 * O id que chega da action e texto do cliente: a FK do banco nao sabe de empresa nem de
 * ativo/arquivado. Cada id de outra tabela e reconferido dentro da transacao.
 */
describe('ids vindos do formulario sao reconferidos contra a empresa', () => {
  it('responsavel de outra empresa, inativo ou inexistente e recusado — em criar e no cabecalho', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Grafica Vizinha' } })
    const deOutra = await prisma.usuario.create({ data: { empresaId: outra.id, nome: 'Estranho', login: `e-${randomUUID()}`, senhaHash: 'x' } })
    const inativo = await prisma.usuario.create({ data: { empresaId: base.empresaId, nome: 'Demitido', login: `d-${randomUUID()}`, senhaHash: 'x', ativo: false } })

    await expect(criarOrdem(ctx(), { estado: 'aberta', responsavelId: deOutra.id })).rejects.toThrow(/respons[áa]vel/i)
    await expect(criarOrdem(ctx(), { estado: 'aberta', responsavelId: inativo.id })).rejects.toThrow(/respons[áa]vel/i)
    await expect(criarOrdem(ctx(), { estado: 'aberta', responsavelId: randomUUID() })).rejects.toThrow(/respons[áa]vel/i)

    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(atualizarCabecalho(ctx(), ordem.id, ordem.versao, { responsavelId: deOutra.id })).rejects.toThrow(/respons[áa]vel/i)
    await expect(atualizarCabecalho(ctx(), ordem.id, ordem.versao, { responsavelId: inativo.id })).rejects.toThrow(/respons[áa]vel/i)
    expect((await prisma.ordemServico.findUniqueOrThrow({ where: { id: ordem.id } })).responsavelId).toBe(base.usuarioId)
  })

  it('material de outra empresa ou inativo e recusado no item', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Grafica Vizinha' } })
    const deOutra = await prisma.material.create({ data: { empresaId: outra.id, nome: 'ACM 3mm', preco: '281.0000', unidadeCobranca: 'm2' } })
    const inativo = await prisma.material.create({ data: { empresaId: base.empresaId, nome: 'Lona antiga', preco: '35.0000', unidadeCobranca: 'm2', ativo: false } })
    const meu = await prisma.material.create({ data: { empresaId: base.empresaId, nome: 'ACM 3mm', preco: '281.0000', unidadeCobranca: 'm2' } })
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })

    const comMaterial = (materialId: string | null): DadosItem => ({ ...UNIDADE('PLACA', 1, '281.00'), materialId })
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, comMaterial(deOutra.id))).rejects.toThrow(/material/i)
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, comMaterial(inativo.id))).rejects.toThrow(/material/i)
    await expect(adicionarItem(ctx(), ordem.id, ordem.versao, comMaterial(randomUUID()))).rejects.toThrow(/material/i)
    expect(await prisma.itemOrdem.count({ where: { ordemId: ordem.id } })).toBe(0)

    const r = await adicionarItem(ctx(), ordem.id, ordem.versao, comMaterial(meu.id))
    expect(r.precoFinal).toBe('281.00')
  })

  it('cliente arquivado nao pode ser posto na ordem', async () => {
    await prisma.cliente.update({ where: { id: clienteId }, data: { arquivadoEm: new Date() } })
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    await expect(atualizarCabecalho(ctx(), ordem.id, ordem.versao, { clienteId })).rejects.toThrow(/cliente/i)
    await expect(criarOrdem(ctx(), { estado: 'aberta', clienteId })).rejects.toThrow(/cliente/i)
  })

  it('item com valor unitario negativo nao abaixa o preco final', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const v = (await adicionarItem(ctx(), ordem.id, ordem.versao, UNIDADE('PLACA', 1, '281.00'))).versao
    await expect(adicionarItem(ctx(), ordem.id, v, UNIDADE('DESCONTO', 1, '-100.00'))).rejects.toThrow(/negativo/)
    expect((await obterOrdemParaTela(base.empresaId, ordem.id))?.precoFinal).toBe('281.00')
  })
})

/*
 * O impresso e um documento que ja foi para a mao do cliente. Ele nao pode mudar
 * porque o cadastro mudou depois -- e ate agora o documento MUDAVA: nome,
 * apelido e telefone eram congelados na ordem, mas o CPF/CNPJ era lido da
 * relacao viva na hora de imprimir. Bastava corrigir um CNPJ digitado errado
 * para a ordem de tres meses atras passar a sair com outro numero.
 */
describe('impresso: o cadastro do cliente fica congelado na ordem', () => {
  it('corrigir o cadastro depois nao muda a folha da ordem antiga', async () => {
    const cliente = await prisma.cliente.create({
      data: {
        empresaId: base.empresaId, nome: 'Serralheria do Vale', documento: '00150991000199',
        endereco: 'Rua Padre Fernandes, 120', bairro: 'Centro', cidade: 'Unaí', uf: 'MG', cep: '38610-000',
      },
    })
    const ordem = await criarOrdem(ctx(), { estado: 'aberta', clienteId: cliente.id })

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { nome: 'Serralheria do Vale LTDA', documento: '39346861028686', endereco: 'Av. Nova, 900', cidade: 'Paracatu' },
    })

    const folha = await obterImpresso(base.empresaId, ordem.id)
    expect(folha?.ordem.cliente).toMatchObject({
      nome: 'Serralheria do Vale',
      documento: '00150991000199',
      endereco: 'Rua Padre Fernandes, 120, Centro · Unaí/MG · 38610-000',
    })
  })

  it('venda de balcao nao inventa endereco', async () => {
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    expect((await obterImpresso(base.empresaId, ordem.id))?.ordem.cliente).toBeNull()
  })

  it('cadastro pela metade imprime so o que existe', async () => {
    const cliente = await prisma.cliente.create({
      data: { empresaId: base.empresaId, nome: 'Cliente sem ficha completa', cidade: 'Unaí', uf: 'MG' },
    })
    const ordem = await criarOrdem(ctx(), { estado: 'aberta', clienteId: cliente.id })
    const folha = await obterImpresso(base.empresaId, ordem.id)
    expect(folha?.ordem.cliente?.endereco).toBe('Unaí/MG')
    expect(folha?.ordem.cliente?.documento).toBeNull()
  })
})

describe('minimo de cobranca da familia', () => {
  async function comMinimo(minimo: string | null) {
    const familia = await prisma.familiaPreco.create({
      data: { empresaId: base.empresaId, nome: `Chapa ${randomUUID().slice(0, 8)}`, unidadePadrao: 'm2', margem: '120', arredondamento: '0.01', minimoCobranca: minimo },
    })
    return prisma.material.create({
      data: { empresaId: base.empresaId, nome: `ACM ${randomUUID().slice(0, 8)}`, preco: '100', custo: '45', familiaPrecoId: familia.id, unidadeCobranca: 'm2' },
    })
  }

  it('peca menor que o minimo e cobrada pelo minimo', async () => {
    const material = await comMinimo('1')
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    // 0,5 x 0,8 = 0,40 m2, abaixo do piso de 1 m2 da familia.
    const r = await adicionarItem(ctx(), ordem.id, ordem.versao, {
      descricao: 'Placa pequena', materialId: material.id, quantidade: 1,
      altura: '0.5', largura: '0.8', unidadeCobranca: 'm2', valorUnitario: '100.00',
    })
    expect(r.subtotalItens).toBe('100.00')
  })

  it('peca maior que o minimo paga a medida real', async () => {
    const material = await comMinimo('1')
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const r = await adicionarItem(ctx(), ordem.id, ordem.versao, {
      descricao: 'Placa grande', materialId: material.id, quantidade: 1,
      altura: '2', largura: '1.5', unidadeCobranca: 'm2', valorUnitario: '100.00',
    })
    expect(r.subtotalItens).toBe('300.00')
  })

  it('familia sem minimo nao muda nada', async () => {
    const material = await comMinimo(null)
    const ordem = await criarOrdem(ctx(), { estado: 'aberta' })
    const r = await adicionarItem(ctx(), ordem.id, ordem.versao, {
      descricao: 'Placa pequena', materialId: material.id, quantidade: 1,
      altura: '0.5', largura: '0.8', unidadeCobranca: 'm2', valorUnitario: '100.00',
    })
    expect(r.subtotalItens).toBe('40.00')
  })
})
