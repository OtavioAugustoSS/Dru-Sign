import { describe, expect, it } from 'vitest'
import { TEXTO, TEXTO_URGENCIA, TOM_ESTADO, TOM_PAGAMENTO, TOM_RECENCIA, TOM_TIPO_CONTA, TOM_TIPO_LANCAMENTO, type Tom } from './selo'

const TONS: Tom[] = ['neutro', 'marca', 'bom', 'atencao', 'ruim']

/**
 * Estes mapas nasceram de sete copias espalhadas que ja tinham divergido. O teste
 * fixa o significado: se alguem trocar "nao pago" de vermelho para verde, quebra
 * aqui e nao no balcao.
 */
describe('significado de cor', () => {
  it.each([
    ['estado da ordem', TOM_ESTADO, ['orcamento', 'aberta', 'concluida', 'cancelada']],
    ['pagamento', TOM_PAGAMENTO, ['nao_pago', 'parcial', 'pago']],
    ['recencia do cliente', TOM_RECENCIA, ['ativo', 'adormecido', 'perdido']],
    ['tipo de lancamento', TOM_TIPO_LANCAMENTO, ['entrada', 'saida']],
    ['tipo de conta', TOM_TIPO_CONTA, ['receita', 'despesa']],
  ])('%s cobre todos os valores, e so tons conhecidos', (_nome, mapa, valores) => {
    expect(Object.keys(mapa).sort()).toEqual([...(valores as string[])].sort())
    for (const tom of Object.values(mapa as Record<string, Tom>)) {
      expect(TONS).toContain(tom)
    }
  })

  it('o que custa dinheiro e vermelho, o que esta resolvido e verde', () => {
    expect(TOM_PAGAMENTO.nao_pago).toBe('ruim')
    expect(TOM_PAGAMENTO.pago).toBe('bom')
    expect(TOM_ESTADO.cancelada).toBe('ruim')
    expect(TOM_ESTADO.concluida).toBe('bom')
    expect(TOM_TIPO_LANCAMENTO.saida).toBe('ruim')
  })

  it('urgencia cobre os quatro grupos, e so "esta semana" fica sem cor propria', () => {
    expect(Object.keys(TEXTO_URGENCIA).sort()).toEqual(['atrasada', 'hoje', 'sem_data', 'semana'])
    expect(TEXTO_URGENCIA.atrasada).toBe('text-danger')
    // Se tudo tem cor, nada tem: o grupo normal fica com a cor do corpo.
    expect(TEXTO_URGENCIA.semana).toBe('')
  })

  it('todo tom tem classe de texto correspondente', () => {
    for (const tom of TONS) {
      expect(TEXTO[tom]).toMatch(/^text-/)
    }
  })
})
