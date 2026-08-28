import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { criarMaterial, atualizarMaterial, listarMateriais, obterMaterial, definirAtivo } from './repositorio'

let empresaId = ''

beforeEach(async () => {
  empresaId = (await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })).id
})

describe('materiais (banco real)', () => {
  it('guarda o preco em numeric(12,4) e devolve Decimal do dominio', async () => {
    const m = await criarMaterial(empresaId, { nome: 'ACM 3mm', categoria: 'Placas', preco: dinheiro('281'), unidadeCobranca: 'm2' })
    expect(m.preco.toString()).toBe('281')
    expect(m.ativo).toBe(true)
    const lido = await obterMaterial(empresaId, m.id)
    expect(lido?.preco.equals(dinheiro('281'))).toBe(true)
    expect(lido?.unidadeCobranca).toBe('m2')
  })

  it('preserva quatro casas', async () => {
    const m = await criarMaterial(empresaId, { nome: 'Perfil', preco: dinheiro('28.1234'), unidadeCobranca: 'metro_linear' })
    expect((await obterMaterial(empresaId, m.id))?.preco.toString()).toBe('28.1234')
  })

  it('nome e unico por empresa', async () => {
    await criarMaterial(empresaId, { nome: 'Lona', preco: dinheiro('83'), unidadeCobranca: 'm2' })
    await expect(criarMaterial(empresaId, { nome: 'Lona', preco: dinheiro('90'), unidadeCobranca: 'm2' }))
      .rejects.toMatchObject({ code: 'P2002' })
  })

  it('lista so ativos por padrao, em ordem de nome', async () => {
    const a = await criarMaterial(empresaId, { nome: 'Zeta', preco: dinheiro('1'), unidadeCobranca: 'unidade' })
    await criarMaterial(empresaId, { nome: 'Alfa', preco: dinheiro('1'), unidadeCobranca: 'unidade' })
    await definirAtivo(empresaId, a.id, false)
    expect((await listarMateriais(empresaId)).map((m) => m.nome)).toEqual(['Alfa'])
    expect((await listarMateriais(empresaId, { incluirInativos: true })).map((m) => m.nome)).toEqual(['Alfa', 'Zeta'])
  })

  it('atualiza preco e unidade', async () => {
    const m = await criarMaterial(empresaId, { nome: 'Letra caixa', preco: dinheiro('30'), unidadeCobranca: 'unidade' })
    const n = await atualizarMaterial(empresaId, m.id, { nome: 'Letra caixa PVC 10mm', preco: dinheiro('34'), unidadeCobranca: 'unidade' })
    expect(n.nome).toBe('Letra caixa PVC 10mm')
    expect(n.preco.toString()).toBe('34')
  })
})
