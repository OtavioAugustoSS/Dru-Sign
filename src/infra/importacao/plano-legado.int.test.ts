import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { importarPlanoLegado } from './plano-legado'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CONTAS.DBF'

// O harness trunca antes de cada `it`: tudo num teste so.
describe.skipIf(!existsSync(DBF))('importacao do plano de contas do legado', () => {
  it('importa as 48 contas como estao, aponta a empresa para VENDAS DIVERSAS e nao repete', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    const r = await importarPlanoLegado(DBF, empresa.id)
    expect(r).toMatchObject({ total: 48, receitas: 3, despesas: 45, jaExistiam: 0, contaRecebimento: 'VENDAS DIVERSAS' })

    const contas = await prisma.contaPlano.findMany({ where: { empresaId: empresa.id }, orderBy: { codigo: 'asc' } })
    expect(contas).toHaveLength(48)
    expect(contas[0]).toMatchObject({ codigo: 1, codigoLegado: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL', ativa: true })
    expect(contas[5]).toMatchObject({ codigo: 6, nome: 'MANUTENÇÃO DO VEÍCULO', grupo: 'DESPESAS COM VEICULO' }) // CP1252 decodificado
    expect(contas[23]?.nome).toBe('ODETE   - PESSOAL') // como esta, inclusive os espacos
    expect(new Set(contas.map((c) => c.grupo)).size).toBe(6)

    const e = await prisma.empresa.findUniqueOrThrow({ where: { id: empresa.id }, include: { contaRecebimento: true } })
    expect(e.contaRecebimento?.nome).toBe('VENDAS DIVERSAS')

    const de_novo = await importarPlanoLegado(DBF, empresa.id)
    expect(de_novo).toMatchObject({ total: 0, jaExistiam: 48 })
    expect(await prisma.contaPlano.count({ where: { empresaId: empresa.id } })).toBe(48)
  })
})
