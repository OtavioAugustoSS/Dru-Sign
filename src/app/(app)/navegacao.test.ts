import { describe, expect, it } from 'vitest'
import { GRUPOS, hrefAtivo, navegacaoPara, NAVEGACAO } from './navegacao'

const HREFS = NAVEGACAO.map((i) => i.href)

describe('hrefAtivo', () => {
  it('acende o item da propria tela', () => {
    expect(hrefAtivo('/ordens', HREFS)).toBe('/ordens')
    expect(hrefAtivo('/clientes', HREFS)).toBe('/clientes')
  })

  it('mantem o item aceso nas telas filhas', () => {
    expect(hrefAtivo('/ordens/nova', HREFS)).toBe('/ordens')
    expect(hrefAtivo('/ordens/01a04f12-fa79-7258', HREFS)).toBe('/ordens')
    expect(hrefAtivo('/clientes/abc/editar', HREFS)).toBe('/clientes')
    // "Nova saida" nao esta no menu: quem acende e o livro-caixa, de onde ela sai.
    expect(hrefAtivo('/financeiro/saida', HREFS)).toBe('/financeiro')
  })

  // Sem "vence o mais longo", estas duas acenderiam o item pai.
  it('prefere o item mais especifico quando dois casam', () => {
    expect(hrefAtivo('/clientes/carteira', HREFS)).toBe('/clientes/carteira')
    expect(hrefAtivo('/financeiro/contador', HREFS)).toBe('/financeiro/contador')
  })

  // Sem o caso especial, a raiz seria prefixo de tudo e acenderia sempre.
  it('a raiz so acende nela mesma', () => {
    expect(hrefAtivo('/', HREFS)).toBe('/')
    expect(hrefAtivo('/ordens', HREFS)).not.toBe('/')
  })

  it('nao acende nada onde nao ha item', () => {
    expect(hrefAtivo('/rota-que-nao-existe', HREFS)).toBeNull()
  })
})

describe('estrutura do menu', () => {
  it('todo item com grupo aponta para um grupo declarado', () => {
    const chaves = GRUPOS.map((g) => g.chave)
    for (const item of NAVEGACAO) {
      if (item.grupo) expect(chaves).toContain(item.grupo)
    }
  })

  it('o nome no menu nunca se repete', () => {
    const titulos = NAVEGACAO.map((i) => i.titulo)
    expect(new Set(titulos).size).toBe(titulos.length)
  })

  it('quem e da operacao ve so o que lhe cabe', () => {
    expect(navegacaoPara('operacao').map((i) => i.titulo)).toEqual([
      'Ordens', 'Clientes', 'Fila de produção', 'Histórico',
    ])
  })

  it('quem e da administracao ve tudo, com a fila de trabalho no topo', () => {
    const admin = navegacaoPara('administracao')
    expect(admin).toHaveLength(NAVEGACAO.length)
    expect(admin[0]?.titulo).toBe('Fila de trabalho')
    expect(admin[0]?.grupo).toBeUndefined()
  })

  // Para a operacao, `/` JA E a fila de producao. Sem esta correcao a pessoa
  // entra, cai em `/` e nao ve nada aceso no menu.
  it('a fila de producao aponta para a raiz quando quem olha e da operacao', () => {
    const itens = navegacaoPara('operacao')
    const fila = itens.find((i) => i.titulo === 'Fila de produção')
    expect(fila?.href).toBe('/')
    expect(hrefAtivo('/', itens.map((i) => i.href))).toBe('/')

    // e continua sendo /producao para a administracao, que tem a propria fila em `/`
    const daAdmin = navegacaoPara('administracao')
    expect(daAdmin.find((i) => i.titulo === 'Fila de produção')?.href).toBe('/producao')
    expect(hrefAtivo('/', daAdmin.map((i) => i.href))).toBe('/')
  })
})
