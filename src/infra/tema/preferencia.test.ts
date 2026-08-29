import { describe, expect, it } from 'vitest'
import { atributoDoTema, normalizarTema, ROTULO_TEMA, TEMAS, TEMA_PADRAO } from './preferencia'

describe('preferencia de tema', () => {
  describe('normalizarTema', () => {
    it.each(TEMAS)('aceita o tema conhecido %s', (tema) => {
      expect(normalizarTema(tema)).toBe(tema)
    })

    // O cookie vem do navegador: e texto de fora e pode vir com qualquer coisa.
    it.each([undefined, null, '', 'dark', 'CLARO', 'escuro ', '__proto__', 'toString'])(
      'devolve o padrao para %o',
      (valor) => {
        expect(normalizarTema(valor)).toBe(TEMA_PADRAO)
      },
    )
  })

  describe('atributoDoTema', () => {
    it('traduz a escolha explicita para o que o Tabler entende', () => {
      expect(atributoDoTema('claro')).toBe('light')
      expect(atributoDoTema('escuro')).toBe('dark')
    })

    // Este null e o que faz o servidor NAO escrever o atributo e deixar o script
    // do navegador decidir pelo sistema operacional. Se virar 'light', quem usa o
    // Windows no escuro passa a receber a tela clara.
    it('nao decide nada quando quem manda e o sistema operacional', () => {
      expect(atributoDoTema('sistema')).toBeNull()
    })
  })

  it('todo tema tem rotulo em portugues', () => {
    for (const tema of TEMAS) {
      expect(ROTULO_TEMA[tema]).toBeTruthy()
    }
  })
})
