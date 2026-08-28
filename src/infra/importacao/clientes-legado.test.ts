import { describe, it, expect } from 'vitest'
import { converterRegistro } from './conversao-clientes'
import type { RegistroDbf } from './dbf'

function registro(valores: Record<string, string | number | null>, apagado = false): RegistroDbf {
  return { apagado, valores }
}

describe('converterRegistro', () => {
  it('mapeia os campos do CLIENTES.DBF, junta telefones e descarta lixo', () => {
    const r = converterRegistro(registro({
      COD: 26, NOM: 'ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ', EST: 'FACTU',
      TEL1: '(38)3676-6222', TEL2: '(  )    -', FAX: '(38)', CEL: '(38)9968-1168', TELEFONE1: '(38)3676-6222',
      RUA: 'R. EDUARDO RODRIGUES BARBOSA N 180', CPL: 'SALA 2', BAI: '', CID: 'UNAI', UF: 'MG', CEP: '38610-000',
      CTO: 'ELAINE', EMAIL: '', EMAIL1: 'factu@exemplo.com', CGC: '00150991000199', CPF: '',
      OBS1: 'Empenho separado', OBS2: '', OBS3: 'por secretaria', DATA: '20120508',
    }))
    expect(r.codigoLegado).toBe(26)
    expect(r.apagado).toBe(false)
    expect(r.cadastradoEm?.toISOString()).toBe('2012-05-08T00:00:00.000Z')
    expect(r.dados).toEqual({
      nome: 'ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ',
      apelido: 'FACTU',
      documento: '00150991000199',
      email: 'factu@exemplo.com',
      contato: 'ELAINE',
      endereco: 'R. EDUARDO RODRIGUES BARBOSA N 180, SALA 2',
      bairro: null,
      cidade: 'UNAI',
      uf: 'MG',
      cep: '38610-000',
      observacoes: 'Empenho separado\npor secretaria',
      telefones: ['(38)3676-6222', '(38)9968-1168'],
    })
    expect(r.descartados).toBe(1) // '(38)' tem so 2 digitos
  })

  it('registro apagado, sem nome e sem data', () => {
    const r = converterRegistro(registro({ COD: 7, NOM: '', DATA: '' }, true))
    expect(r.apagado).toBe(true)
    expect(r.dados.nome).toBe('(sem nome no legado, cod 7)')
    expect(r.cadastradoEm).toBeNull()
    expect(r.dados.telefones).toEqual([])
  })

  it('CPF vale quando nao ha CGC', () => {
    const r = converterRegistro(registro({ COD: 1, NOM: 'X', CGC: '', CPF: '01754796150' }))
    expect(r.dados.documento).toBe('01754796150')
  })
})
