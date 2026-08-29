import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { buscarHistorico, historicoDoCliente } from './consulta'

let empresaId = ''
let clienteId = ''

const ordem = (numero: number, p: Record<string, unknown> = {}) => ({
  empresaId, numero, dataEntrada: new Date('2019-06-15T00:00:00.000Z'), clienteNome: 'CLIENTE DIVERSOS',
  telefone: '', situacao: 'Entrega Normal', texto: 'PLACA ACM 60X80',
  valorProdutos: '0.0000', valorServicos: '0.0000', maoDeObra: '0.0000', deslocamento: '0.0000',
  desconto: '0.0000', total: '100.0000', forma: 'Avista', responsavel: 'ODETE', usuario: 'ODETE', ...p,
})

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  empresaId = empresa.id
  const cliente = await prisma.cliente.create({ data: { empresaId, nome: 'FAZENDA HJ', apelido: 'HJ', codigoLegado: 42 } })
  clienteId = cliente.id
  await prisma.ordemLegado.createMany({
    data: [
      ordem(1001, { clienteId, clienteNome: 'SANDRA HOFIG DE BARROS', texto: 'PLACA ACM 60X80\nADESIVO IMPRESSO', total: '723.0000', dataEntrada: new Date('2019-06-15T00:00:00.000Z') }),
      ordem(1002, { clienteId, texto: 'BANNER 200X100', total: '150.0000', dataEntrada: new Date('2021-03-10T00:00:00.000Z') }),
      ordem(1003, { clienteNome: 'C A N C E L A D O', nomeDestruido: true, texto: 'FAIXA', total: '80.0000', dataEntrada: new Date('2015-01-20T00:00:00.000Z') }),
      ordem(1004, { texto: 'LETRA CAIXA EM PVC', total: '2500.0000', dataEntrada: new Date('2024-11-05T00:00:00.000Z'), dataSaidaSuspeita: true }),
    ],
  })
})

describe('consulta do historico (banco real)', () => {
  it('sem filtro, traz da mais recente para a mais antiga, com o total somado', async () => {
    const h = await buscarHistorico(empresaId, {})
    expect(h.linhas.map((l) => l.numero)).toEqual([1004, 1002, 1001, 1003])
    expect(h).toMatchObject({ encontradas: 4, somaTotal: '3453.00' })
  })

  it('busca por numero exato, por nome e por trecho do texto, sem diferenciar maiuscula', async () => {
    expect((await buscarHistorico(empresaId, { q: '1002' })).linhas.map((l) => l.numero)).toEqual([1002])
    expect((await buscarHistorico(empresaId, { q: 'sandra' })).linhas.map((l) => l.numero)).toEqual([1001])
    expect((await buscarHistorico(empresaId, { q: 'letra caixa' })).linhas.map((l) => l.numero)).toEqual([1004])
    expect((await buscarHistorico(empresaId, { q: 'adesivo' })).linhas.map((l) => l.numero)).toEqual([1001])
    expect((await buscarHistorico(empresaId, { q: 'nao existe nada assim' })).linhas).toEqual([])
  })

  it('filtra por periodo da data de entrada; periodo invertido e recusado', async () => {
    expect((await buscarHistorico(empresaId, { de: '2019-01-01', ate: '2021-12-31' })).linhas.map((l) => l.numero)).toEqual([1002, 1001])
    await expect(buscarHistorico(empresaId, { de: '2021-12-31', ate: '2019-01-01' })).rejects.toThrow(/período/)
  })

  it('traz as marcas que a importacao gravou, para a tela nao mentir', async () => {
    const h = await buscarHistorico(empresaId, { q: '1003' })
    expect(h.linhas[0]).toMatchObject({ clienteNome: 'C A N C E L A D O', nomeDestruido: true })
    expect((await buscarHistorico(empresaId, { q: '1004' })).linhas[0]).toMatchObject({ dataSaidaSuspeita: true })
  })

  it('o limite corta a lista mas a contagem diz quantas existem', async () => {
    const h = await buscarHistorico(empresaId, { limite: 2 })
    expect(h.linhas).toHaveLength(2)
    expect(h.encontradas).toBe(4)
  })

  it('as ordens antigas do cliente vem pelo id, da mais recente para a mais antiga', async () => {
    expect((await historicoDoCliente(empresaId, clienteId)).map((l) => l.numero)).toEqual([1002, 1001])
  })

  it('nao enxerga o historico de outra empresa', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    expect((await buscarHistorico(outra.id, {})).linhas).toEqual([])
    expect(await historicoDoCliente(outra.id, clienteId)).toEqual([])
  })
})
