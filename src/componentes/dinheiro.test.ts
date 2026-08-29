import { describe, expect, it } from 'vitest'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { valorEmReais } from './dinheiro'

/**
 * O painel de pagamento tinha um formatador proprio, por expressao regular, que
 * foi aposentado. Estes testes provam duas coisas:
 *
 *  1. para os valores que a tela realmente recebe (o repositorio sempre entrega
 *     com duas casas), o que aparece na tela nao mudou;
 *  2. para tudo o mais, o antigo estava errado -- entao a troca e correcao, nao
 *     regressao.
 */

/** A implementacao aposentada, mantida aqui so como referencia do teste. */
const regexAposentada = (v: string) => `R$ ${v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

describe('valorEmReais', () => {
  // Exatamente o formato que `toFixed(2)` produz no repositorio.
  const comoOrepositorioEntrega = ['0.00', '80.00', '150.00', '1234.56', '123456.78', '1000.00']

  it.each(comoOrepositorioEntrega)('mostra %s igual ao que o painel ja mostrava', (valor) => {
    expect(valorEmReais(valor)).toBe(regexAposentada(valor))
  })

  it('aceita tanto a string do banco quanto o Decimal do dominio', () => {
    expect(valorEmReais('1234.56')).toBe('R$ 1.234,56')
    expect(valorEmReais(dinheiro('1234.56'))).toBe('R$ 1.234,56')
  })

  describe('onde o formatador aposentado errava', () => {
    // Sem centavos o antigo escrevia "R$ 80", que nao e como se escreve dinheiro.
    it('completa os centavos', () => {
      expect(valorEmReais('80')).toBe('R$ 80,00')
      expect(regexAposentada('80')).toBe('R$ 80')
    })

    it('completa a segunda casa', () => {
      expect(valorEmReais('80.5')).toBe('R$ 80,50')
      expect(regexAposentada('80.5')).toBe('R$ 80,5')
    })

    // O antigo nao arredondava: mostrava a terceira casa como se fosse centavo.
    it('arredonda em vez de mostrar a terceira casa', () => {
      expect(valorEmReais('1234.567')).toBe('R$ 1.234,57')
      expect(regexAposentada('1234.567')).toBe('R$ 1.234,567')
    })

    it('nao confunde milhar com centavo quando falta casa', () => {
      expect(valorEmReais('999.999')).toBe('R$ 1.000,00')
      expect(regexAposentada('999.999')).toBe('R$ 999,999')
    })
  })

  it('separa o milhar', () => {
    expect(valorEmReais('12345678.90')).toBe('R$ 12.345.678,90')
  })
})
