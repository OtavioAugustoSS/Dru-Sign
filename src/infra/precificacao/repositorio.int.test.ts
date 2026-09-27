import { describe, expect, it } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { paraBanco } from '@/infra/db/decimal'
import { aplicar, simular, excluirFamilia, historicoDoMaterial, listarFamilias } from './repositorio'

/** Uma empresa com um usuario e uma familia a 100% de margem, arredondando ao centavo. */
async function cenario() {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Gráfica de Teste' } })
  const usuario = await prisma.usuario.create({
    data: { empresaId: empresa.id, nome: 'Odete', login: `odete-${empresa.id.slice(0, 8)}`, senhaHash: 'x', papel: 'administracao' },
  })
  const familia = await prisma.familiaPreco.create({
    data: {
      empresaId: empresa.id,
      nome: 'Bobina',
      unidadePadrao: 'm2',
      margem: paraBanco(dinheiro(100)),
      arredondamento: paraBanco(dinheiro('0.01')),
    },
  })
  return { empresa, usuario, familia }
}

async function material(
  empresaId: string,
  familiaPrecoId: string | null,
  nome: string,
  preco: string,
  custo: string | null,
  precoTravado = false,
) {
  return prisma.material.create({
    data: {
      empresaId,
      familiaPrecoId,
      nome,
      preco: paraBanco(dinheiro(preco)),
      custo: custo === null ? null : paraBanco(dinheiro(custo)),
      precoTravado,
      unidadeCobranca: 'm2',
    },
  })
}

describe('recalculo de familia', () => {
  it('recalcula quem tem custo e pula travado e sem custo', async () => {
    const { empresa, usuario, familia } = await cenario()
    const calculado = await material(empresa.id, familia.id, 'Lona calculada', '10', '38')
    const travado = await material(empresa.id, familia.id, 'Lona travada', '265', '38', true)
    const semCusto = await material(empresa.id, familia.id, 'Lona sem custo', '44', null)

    const r = await aplicar(
      empresa.id,
      familia.id,
      { nome: 'Bobina', unidadePadrao: 'm2', margem: dinheiro(120), arredondamento: dinheiro('0.01'), minimoCobranca: null },
      usuario.id,
    )

    expect(r).toEqual({ afetados: 1, pulados: 2 })
    // 38 x 2,20 = 83,60
    expect((await prisma.material.findUniqueOrThrow({ where: { id: calculado.id } })).preco.toFixed(2)).toBe('83.60')
    expect((await prisma.material.findUniqueOrThrow({ where: { id: travado.id } })).preco.toFixed(2)).toBe('265.00')
    expect((await prisma.material.findUniqueOrThrow({ where: { id: semCusto.id } })).preco.toFixed(2)).toBe('44.00')
  })

  it('grava uma linha de historico por preco que mudou de fato', async () => {
    const { empresa, usuario, familia } = await cenario()
    const m = await material(empresa.id, familia.id, 'Lona do historico', '10', '38')
    const parado = await material(empresa.id, familia.id, 'Lona ja no preco', '76', '38')

    await aplicar(
      empresa.id,
      familia.id,
      { nome: 'Bobina', unidadePadrao: 'm2', margem: dinheiro(100), arredondamento: dinheiro('0.01'), minimoCobranca: null },
      usuario.id,
    )

    const h = await historicoDoMaterial(empresa.id, m.id)
    expect(h).toHaveLength(1)
    expect(h[0]!.de.toFixed(2)).toBe('10.00')
    expect(h[0]!.para.toFixed(2)).toBe('76.00')
    expect(h[0]!.motivo).toBe('margem da família')
    expect(h[0]!.usuario).toBe('Odete')

    // 38 x 2 = 76, que e o preco que ja estava: nao mudou, nao vira historico.
    expect(await historicoDoMaterial(empresa.id, parado.id)).toHaveLength(0)
  })

  it('simular nao grava nada', async () => {
    const { empresa, familia } = await cenario()
    const m = await material(empresa.id, familia.id, 'Lona intocada', '10', '38')

    const previa = await simular(empresa.id, familia.id, { margem: dinheiro(300), arredondamento: dinheiro('0.01') })

    expect(previa.linhas[0]!.precoNovo!.toFixed(2)).toBe('152.00')
    expect((await prisma.material.findUniqueOrThrow({ where: { id: m.id } })).preco.toFixed(2)).toBe('10.00')
    expect(await historicoDoMaterial(empresa.id, m.id)).toHaveLength(0)
  })
})

describe('faixa de preco da familia', () => {
  it('ignora quem nao tem custo, para o piso da venda nao virar zero', async () => {
    const { empresa, familia } = await cenario()
    await material(empresa.id, familia.id, 'Lona com custo', '76', '38')
    await material(empresa.id, familia.id, 'Lona aguardando preço', '0', null)

    const f = (await listarFamilias(empresa.id)).find((x) => x.id === familia.id)!

    expect(f.materiais).toBe(2)
    expect(f.semCusto).toBe(1)
    expect(f.vendaMin!.toFixed(2)).toBe('76.00')
    expect(f.custoMin!.toFixed(2)).toBe('38.00')
  })
})

describe('excluir familia', () => {
  it('recusa enquanto houver material vinculado', async () => {
    const { empresa, familia } = await cenario()
    await material(empresa.id, familia.id, 'Lona vinculada', '76', '38')

    expect(await excluirFamilia(empresa.id, familia.id)).toEqual({ excluida: false, materiais: 1 })
    expect(await prisma.familiaPreco.findUnique({ where: { id: familia.id } })).not.toBeNull()
  })

  it('exclui quando ninguem depende dela', async () => {
    const { empresa, familia } = await cenario()

    expect(await excluirFamilia(empresa.id, familia.id)).toEqual({ excluida: true, materiais: 0 })
    expect(await prisma.familiaPreco.findUnique({ where: { id: familia.id } })).toBeNull()
  })
})
