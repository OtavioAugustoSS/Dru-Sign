import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { importarOrdensLegado } from './ordens-legado'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/ORDEM.DBF'

// O harness trunca antes de cada `it`: tudo num teste so, e a importacao inteira demora.
describe.skipIf(!existsSync(DBF))('importacao das ordens legadas', () => {
  it('importa as 18.443 como estao, liga ao cliente pelo codigo e nao repete', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    // O CODCLI real da OS 18449 no ORDEM.DBF e 1949 (conferido no arquivo), nao um numero qualquer.
    const sandra = await prisma.cliente.create({ data: { empresaId: empresa.id, nome: 'Sandra Hofig de Barros', codigoLegado: 1949 } })

    const r = await importarOrdensLegado(DBF, empresa.id)
    expect(r).toMatchObject({ total: 18_443, importadas: 18_443, jaExistiam: 0 })
    // A spec fala em 271; medindo, 269 tem saida anterior a entrada com data plausivel e 2
    // (OS 8966 '19170804' e OS 9905 '07060607') tem saida ilegivel — essas contam como impossivel,
    // nao como suspeita, senao a tela prometeria uma data que nao existe.
    expect(r.comSaidaAntesDaEntrada).toBe(269)
    expect(r.comDataSaidaImpossivel).toBeGreaterThanOrEqual(2)
    expect(r.comNomeDestruido).toBe(3152)
    expect(r.somaTotal).toBe('5654432.03')
    expect(r.ligadasACliente).toBeGreaterThan(0)

    expect(await prisma.ordemLegado.count({ where: { empresaId: empresa.id } })).toBe(18_443)

    const os = await prisma.ordemLegado.findFirstOrThrow({ where: { empresaId: empresa.id, numero: 18449 } })
    expect(os.dataEntrada).not.toBeNull()
    expect(os.texto.length).toBeGreaterThan(0)
    expect(paraDominio(os.total).toFixed(2)).toBe('2528.00')
    expect(os.clienteId).toBe(sandra.id)

    // As ordens do cliente ligado aparecem por ele.
    expect(await prisma.ordemLegado.count({ where: { clienteId: sandra.id } })).toBeGreaterThan(0)

    // Data impossivel: null com o bruto guardado.
    const impossivel = await prisma.ordemLegado.findFirst({ where: { empresaId: empresa.id, dataSaidaTexto: { not: null } } })
    expect(impossivel?.dataSaida).toBeNull()
    expect(impossivel?.dataSaidaTexto).toMatch(/^\d{8}$/)

    const deNovo = await importarOrdensLegado(DBF, empresa.id)
    expect(deNovo).toMatchObject({ total: 0, importadas: 0, jaExistiam: 18_443 })
    expect(await prisma.ordemLegado.count({ where: { empresaId: empresa.id } })).toBe(18_443)
  }, 300_000)
})
