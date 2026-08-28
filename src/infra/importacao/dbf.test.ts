import { describe, it, expect } from 'vitest'
import { interpretarDbf } from './dbf'

/** Monta um DBF dBase III minimo: cabecalho, descritores, terminador 0x0D e registros. */
function montarDbf(campos: Array<[string, string, number]>, registros: Array<[boolean, Buffer]>): Buffer {
  const tamReg = 1 + campos.reduce((s, [, , tam]) => s + tam, 0)
  const tamCab = 32 + 32 * campos.length + 1
  const cab = Buffer.alloc(32)
  cab[0] = 0x03
  cab.writeUInt32LE(registros.length, 4)
  cab.writeUInt16LE(tamCab, 8)
  cab.writeUInt16LE(tamReg, 10)
  const descritores = campos.map(([nome, tipo, tam]) => {
    const d = Buffer.alloc(32)
    d.write(nome, 0, 'ascii')
    d[11] = tipo.charCodeAt(0)
    d[16] = tam
    return d
  })
  const corpo = registros.map(([apagado, dados]) => Buffer.concat([Buffer.from(apagado ? '*' : ' '), dados]))
  return Buffer.concat([cab, ...descritores, Buffer.from([0x0d]), ...corpo])
}

describe('interpretarDbf', () => {
  it('le campos, flag de apagado, texto em CP1252 e numero', () => {
    const campos: Array<[string, string, number]> = [['COD', 'N', 5], ['NOM', 'C', 12], ['LIB', 'L', 1]]
    const reg1 = Buffer.concat([Buffer.from('   13', 'ascii'), Buffer.from('ASSOCIA\xc7\xc3O  ', 'latin1'), Buffer.from('T')])
    const reg2 = Buffer.concat([Buffer.from('   26', 'ascii'), Buffer.from('FACTU       ', 'ascii'), Buffer.from('F')])
    const { campos: lidos, registros } = interpretarDbf(montarDbf(campos, [[false, reg1], [true, reg2]]))

    expect(lidos.map((c) => [c.nome, c.tipo, c.tamanho])).toEqual([['COD', 'N', 5], ['NOM', 'C', 12], ['LIB', 'L', 1]])
    expect(registros).toHaveLength(2)
    expect(registros[0]).toEqual({ apagado: false, valores: { COD: 13, NOM: 'ASSOCIAÇÃO', LIB: 'T' } })
    expect(registros[1]).toEqual({ apagado: true, valores: { COD: 26, NOM: 'FACTU', LIB: 'F' } })
  })

  it('numero vazio vira null', () => {
    const buf = montarDbf([['COD', 'N', 5]], [[false, Buffer.from('     ')]])
    expect(interpretarDbf(buf).registros[0]?.valores).toEqual({ COD: null })
  })
})
