import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { importarClientesLegado } from './clientes-legado'
import { buscarClientes } from '@/infra/clientes/repositorio'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CLIENTES.DBF'

// Um unico caso: o setup de integracao trunca o banco antes de CADA `it`, entao a importacao
// (uns 30 s) e as verificacoes precisam viver no mesmo teste.
describe('importacao do CLIENTES.DBF (banco real, arquivo real)', () => {
  it('importa os 3.219 clientes e cumpre o criterio de verificacao da fase', async () => {
    if (!existsSync(DBF)) throw new Error(`Gabarito ausente: ${DBF}. Sem ele a importacao nao tem como ser validada.`)
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    const empresaId = empresa.id

    // 1. Os 3.219 entram, com os 1.978 apagados como arquivados.
    const resultado = await importarClientesLegado(DBF, empresaId)
    expect(resultado.total).toBe(3219)
    expect(resultado.arquivados).toBe(1978)
    expect(resultado.jaExistiam).toBe(0)
    expect(await prisma.cliente.count({ where: { empresaId, arquivadoEm: { not: null } } })).toBe(1978)

    // 2. 3.077 telefones, 1.975 com o nono digito inferido.
    expect(resultado.telefones).toBe(3077)
    expect(resultado.inferidos).toBe(1975)
    expect(resultado.naoDiscaveis).toBe(8)
    expect(resultado.descartados).toBe(63)
    expect(await prisma.telefoneCliente.count({ where: { empresaId } })).toBe(3077)

    // 3. Nenhum celular sobrou com 10 digitos.
    const celularesCurtos = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM telefone_cliente
      WHERE length(normalizado) = 10 AND substr(normalizado, 3, 1) IN ('6','7','8','9')`
    expect(Number(celularesCurtos[0]?.n)).toBe(0)

    // 4. A busca por apelido acha o Bretas e a FACTU.
    expect((await buscarClientes(empresaId, 'bretas')).map((c) => c.nome)).toContain('CENCOSUD BRASIL COMERCIAL')
    expect((await buscarClientes(empresaId, 'factu')).map((c) => c.nome)).toContain('ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ')

    // 5. Original e data de cadastro do legado preservados.
    const factu = await prisma.cliente.findFirst({
      where: { empresaId, codigoLegado: 26 },
      include: { telefones: { orderBy: { ordem: 'asc' } } },
    })
    expect(factu?.criadoEm.toISOString()).toBe('2012-05-08T00:00:00.000Z')
    expect(factu?.telefones.map((t) => [t.original, t.normalizado, t.inferido])).toEqual([
      ['(38)3676-6222', '3836766222', false],
      ['(38)9968-1168', '38999681168', true],
    ])

    // 6. Rodar de novo nao duplica.
    const segunda = await importarClientesLegado(DBF, empresaId)
    expect(segunda.total).toBe(0)
    expect(segunda.jaExistiam).toBe(3219)
    expect(await prisma.cliente.count({ where: { empresaId } })).toBe(3219)
  }, 300_000)
})
