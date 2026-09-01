import { describe, it, expect } from 'vitest'
import { voltarDaOrdem } from './origem'

const CLIENTE = { id: 'c-1', nome: 'Prefeitura de Unaí' }

describe('voltarDaOrdem', () => {
  it.each([
    ['fila', '/', 'Fila de trabalho'],
    ['ordens', '/ordens', 'Ordens'],
    ['producao', '/producao', 'Fila de produção'],
    ['historico', '/historico', 'Histórico'],
    ['financeiro', '/financeiro', 'Livro-caixa'],
  ])('de=%s volta para %s', (de, href, rotulo) => {
    expect(voltarDaOrdem(de, CLIENTE)).toEqual({ href, rotulo })
  })

  it('de=cliente volta para a ficha daquele cliente, com o nome dele no rotulo', () => {
    expect(voltarDaOrdem('cliente', CLIENTE)).toEqual({ href: '/clientes/c-1', rotulo: 'Prefeitura de Unaí' })
  })

  it('venda de balcao nao tem ficha para onde voltar: cai na lista de ordens', () => {
    expect(voltarDaOrdem('cliente', null)).toEqual({ href: '/ordens', rotulo: 'Ordens' })
    expect(voltarDaOrdem('cliente', { id: null, nome: null })).toEqual({ href: '/ordens', rotulo: 'Ordens' })
  })

  it('sem parametro volta para a lista de ordens', () => {
    expect(voltarDaOrdem(undefined, CLIENTE)).toEqual({ href: '/ordens', rotulo: 'Ordens' })
  })

  /*
   * `de` vem do endereco. Nao existe caminho de um valor de fora para o href --
   * o que nao esta na tabela cai no padrao, e isso inclui tentativa de empurrar
   * endereco pronto pelo parametro.
   */
  it.each([
    'nao-existe',
    '/painel',
    'https://exemplo.com',
    '//exemplo.com',
    'javascript:alert(1)',
    '__proto__',
    'constructor',
    'toString',
  ])('chave de fora nao vira destino: %s', (de) => {
    expect(voltarDaOrdem(de, CLIENTE)).toEqual({ href: '/ordens', rotulo: 'Ordens' })
  })
})
