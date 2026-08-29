import { describe, it, expect } from 'vitest'
import { converterOrdemLegado, juntarObservacoes, lerDataDbf } from './ordem'

const vazio: Record<string, string> = {
  NUMERO: '', DATAENT: '', DATASAI: '', CODCLI: '', CADASTRO: '', TELEFONE: '', SITUACAO: '',
  OBS1: '', OBS2: '', OBS3: '', OBS4: '', OBS5: '', OBS6: '', OBS7: '', OBS8: '',
  VLRPROD: '', VLRSERV: '', MAO_OBRA: '', DESLOCA: '', DESCONTO: '', TOTAL: '',
  FORMA: '', RESPONSA: '', USUARIO: '',
}
const linha = (p: Record<string, string>): Record<string, string> => ({ ...vazio, ...p })

describe('lerDataDbf', () => {
  it.each([
    ['20260829', '2026-08-29T00:00:00.000Z'],
    ['20120507', '2012-05-07T00:00:00.000Z'],
  ])('%s vira %s', (bruto: string, iso: string) => {
    expect(lerDataDbf(bruto)?.toISOString()).toBe(iso)
  })

  it.each([
    ['07060607'], // a data absurda que a spec cita, da OS 9905
    ['60180524'],
    ['19170804'],
    ['02000305'],
    [''],
    ['        '],
    ['2026082'],
    ['20261332'],
  ])('recusa %s', (bruto: string) => {
    expect(lerDataDbf(bruto)).toBeNull()
  })
})

describe('juntarObservacoes', () => {
  it('junta OBS1..OBS7 na ordem, descarta vazias e nao inclui OBS8', () => {
    expect(juntarObservacoes(linha({ OBS1: '06 PLACAS ACM', OBS3: '60 X 80', OBS7: 'entregar na fazenda', OBS8: 'Sempre guarde esse comprovante' })))
      .toBe('06 PLACAS ACM\n60 X 80\nentregar na fazenda')
  })
  it('sem observacao nenhuma da string vazia', () => {
    expect(juntarObservacoes(vazio)).toBe('')
  })
  it('preserva o texto como veio, inclusive espacos internos e acentuacao do CP1252', () => {
    expect(juntarObservacoes(linha({ OBS1: '  IMPRESSÃO  ADESIVO   4x0  ' }))).toBe('IMPRESSÃO  ADESIVO   4x0')
  })
})

describe('converterOrdemLegado', () => {
  it('le a OS inteira, com dinheiro em string decimal', () => {
    const o = converterOrdemLegado(linha({
      NUMERO: '18449', DATAENT: '20260820', DATASAI: '20260827', CODCLI: '1949',
      CADASTRO: 'SANDRA HOFIG DE BARROS', TELEFONE: '(38)9874-3013', SITUACAO: 'Entrega direto para o cliente',
      OBS1: '06 PLACAS ACM 60X 80', OBS2: '01 PLACA ACM 50 X 50',
      VLRPROD: '2528.00', TOTAL: '2528.00', DESCONTO: '0.00',
      FORMA: 'Avista', RESPONSA: 'ODETE', USUARIO: 'ODETE',
    }))
    expect(o).toMatchObject({
      numero: 18449, codigoClienteLegado: 1949, clienteNome: 'SANDRA HOFIG DE BARROS',
      telefone: '(38)9874-3013', situacao: 'Entrega direto para o cliente',
      texto: '06 PLACAS ACM 60X 80\n01 PLACA ACM 50 X 50',
      total: '2528.00', valorProdutos: '2528.00', desconto: '0.00',
      forma: 'Avista', responsavel: 'ODETE', usuario: 'ODETE',
      dataSaidaTexto: null, dataSaidaSuspeita: false, nomeDestruido: false,
    })
    expect(o.dataEntrada.toISOString()).toBe('2026-08-20T00:00:00.000Z')
    expect(o.dataSaida?.toISOString()).toBe('2026-08-27T00:00:00.000Z')
  })

  it('data de saida impossivel vira null e o bruto fica guardado ao lado', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '9905', DATAENT: '20130411', DATASAI: '07060607', TOTAL: '10.00' }))
    expect(o.dataSaida).toBeNull()
    expect(o.dataSaidaTexto).toBe('07060607')
  })

  it('saida antes da entrada entra como esta, marcada — sao 271 ordens', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '100', DATAENT: '20200510', DATASAI: '20200409', TOTAL: '10.00' }))
    expect(o.dataSaida?.toISOString()).toBe('2020-04-09T00:00:00.000Z')
    expect(o.dataSaidaSuspeita).toBe(true)
  })

  it('o nome destruido pelo cancelamento do legado entra como esta, marcado — sao 3.152', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '5', DATAENT: '20130101', CADASTRO: 'C A N C E L A D O', TOTAL: '0.00' }))
    expect(o).toMatchObject({ clienteNome: 'C A N C E L A D O', nomeDestruido: true })
  })

  it('venda de balcao do legado nao vira nome de cliente', () => {
    expect(converterOrdemLegado(linha({ NUMERO: '6', DATAENT: '20130101', CADASTRO: 'CLIENTE DIVERSOS', TOTAL: '0.00' })).clienteNome).toBe('CLIENTE DIVERSOS')
  })

  it('valores vazios ou com virgula viram string decimal de duas casas', () => {
    const o = converterOrdemLegado(linha({ NUMERO: '7', DATAENT: '20130101', VLRSERV: '1.358,81', MAO_OBRA: '', DESLOCA: '102,00', TOTAL: '1460,81' }))
    expect(o).toMatchObject({ valorServicos: '1358.81', maoDeObra: '0.00', deslocamento: '102.00', total: '1460.81' })
  })

  it('codigo de cliente ausente ou zero vira null', () => {
    expect(converterOrdemLegado(linha({ NUMERO: '8', DATAENT: '20130101', CODCLI: '0' })).codigoClienteLegado).toBeNull()
    expect(converterOrdemLegado(linha({ NUMERO: '9', DATAENT: '20130101', CODCLI: '' })).codigoClienteLegado).toBeNull()
  })

  it('recusa a linha sem numero ou sem data de entrada, que nao existe na base', () => {
    expect(() => converterOrdemLegado(linha({ NUMERO: '', DATAENT: '20130101' }))).toThrow(/numero/)
    expect(() => converterOrdemLegado(linha({ NUMERO: '10', DATAENT: '' }))).toThrow(/data de entrada/)
  })
})
