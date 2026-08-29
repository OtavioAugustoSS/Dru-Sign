import { describe, expect, it } from 'vitest'
import { limparTextoLegado } from './texto-legado'

describe('limparTextoLegado', () => {
  // O caso real, tirado da tela do arquivo: sete campos OBS, dois com conteudo.
  it('tira as linhas que o sistema antigo usava para dizer "campo vazio"', () => {
    const comoVeioDoBanco = 'FALTA ENTREGAR 12 PLACAS 61 X 40 61,00 732,00\n.\n. REF OR / SER 18449\n.\n.\n.\n.'
    expect(limparTextoLegado(comoVeioDoBanco)).toBe('FALTA ENTREGAR 12 PLACAS 61 X 40 61,00 732,00\n. REF OR / SER 18449')
  })

  it('nao mexe em linha que tem conteudo, mesmo comecando com ponto', () => {
    expect(limparTextoLegado('. 02 ADESIVO IMPRESSO 1,35 X 0,75')).toBe('. 02 ADESIVO IMPRESSO 1,35 X 0,75')
  })

  it('tira linha em branco e linha so com espaco', () => {
    expect(limparTextoLegado('A\n\n   \nB')).toBe('A\nB')
  })

  it('devolve vazio quando a ordem so tinha marcador', () => {
    expect(limparTextoLegado('.\n.\n.')).toBe('')
  })

  it('nao inventa nem perde conteudo', () => {
    const texto = 'PLACA ACM\nINSTALACAO NO VIDRO'
    expect(limparTextoLegado(texto)).toBe(texto)
  })
})
