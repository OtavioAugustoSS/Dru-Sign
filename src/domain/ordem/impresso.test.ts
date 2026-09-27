import { describe, it, expect } from 'vitest'
import { dinheiro } from '../precificacao/dinheiro'
import { descreverCobranca, formatarDimensao, montarEndereco, tituloDocumento, type ItemImpresso } from './impresso'

function item(p: Partial<ItemImpresso>): ItemImpresso {
  return { quantidade: 1, descricao: 'x', unidade: 'unidade', altura: null, largura: null, valorUnitario: dinheiro(1), total: dinheiro(1), ...p }
}

describe('descreverCobranca', () => {
  it('area soma a quantidade: 6 x 0,60 x 0,80 = 2,88 m2', () => {
    expect(descreverCobranca(item({ unidade: 'm2', quantidade: 6, altura: 0.6, largura: 0.8 }))).toBe('área · 2,88 m²')
  })
  it('metro linear e perimetro', () => {
    expect(descreverCobranca(item({ unidade: 'metro_linear', altura: 0.61, largura: 0.6 }))).toBe('metro linear · perímetro 2,42 m')
  })
  it('unidade com medida registrada (OS 18449) continua por unidade', () => {
    expect(descreverCobranca(item({ unidade: 'unidade', quantidade: 12, altura: 0.61, largura: 0.4 }))).toBe('por unidade')
  })

  // A folha vai para o cliente: "0,40 m2" ao lado de R$ 91,20 com unitario de R$ 91,20
  // e uma conta que nao fecha. Quando o piso da familia entrou, a linha tem de dizer.
  it('peca abaixo do minimo diz a area real e o que foi cobrado', () => {
    expect(descreverCobranca(item({ unidade: 'm2', altura: 0.5, largura: 0.8, minimoMedida: 1 })))
      .toBe('área · 0,40 m² · cobrado o mínimo de 1,00 m²')
  })
  it('o minimo vale por peca e a quantidade multiplica os dois lados', () => {
    expect(descreverCobranca(item({ unidade: 'm2', quantidade: 3, altura: 0.5, largura: 0.8, minimoMedida: 1 })))
      .toBe('área · 1,20 m² · cobrado o mínimo de 3,00 m²')
  })
  it('peca acima do minimo nao menciona o minimo', () => {
    expect(descreverCobranca(item({ unidade: 'm2', altura: 2, largura: 1.5, minimoMedida: 1 }))).toBe('área · 3,00 m²')
  })
  it('metro linear abaixo do minimo', () => {
    expect(descreverCobranca(item({ unidade: 'metro_linear', altura: 0.2, largura: 0.3, minimoMedida: 5 })))
      .toBe('metro linear · perímetro 1,00 m · cobrado o mínimo de 5,00 m')
  })
})

describe('formatarDimensao e tituloDocumento', () => {
  it('0,61 × 0,40 m; sem medida e travessao', () => {
    expect(formatarDimensao(0.61, 0.4)).toBe('0,61 × 0,40 m')
    expect(formatarDimensao(null, null)).toBe('—')
  })
  it('orcamento tem titulo proprio', () => {
    expect(tituloDocumento('orcamento')).toBe('Orçamento')
    expect(tituloDocumento('aberta')).toBe('Ordem de Serviço')
  })
})

/*
 * A base veio do legado com muita ficha pela metade: cliente so com cidade,
 * cliente com nada. Endereco montado errado sai da impressora com virgula solta
 * ou barra sem UF, e a folha vai para a mao do cliente assim.
 */
describe('montarEndereco', () => {
  it('monta a linha inteira quando o cadastro esta completo', () => {
    expect(montarEndereco({ endereco: 'Rua Padre Fernandes, 120', bairro: 'Centro', cidade: 'Unaí', uf: 'MG', cep: '38610-000' }))
      .toBe('Rua Padre Fernandes, 120, Centro · Unaí/MG · 38610-000')
  })

  it('so cidade e UF: sem virgula solta na frente', () => {
    expect(montarEndereco({ cidade: 'Bonfinópolis de Minas', uf: 'MG' })).toBe('Bonfinópolis de Minas/MG')
  })

  it('cidade sem UF nao deixa barra pendurada', () => {
    expect(montarEndereco({ cidade: 'Unaí' })).toBe('Unaí')
  })

  it('UF sem cidade nao vira barra sozinha', () => {
    expect(montarEndereco({ uf: 'MG' })).toBe('MG')
  })

  it('rua sem bairro nao termina em virgula', () => {
    expect(montarEndereco({ endereco: 'Fazenda Santo Antônio', cidade: 'Unaí', uf: 'MG' }))
      .toBe('Fazenda Santo Antônio · Unaí/MG')
  })

  it('cadastro sem endereco nenhum devolve null, e a folha omite o rotulo', () => {
    expect(montarEndereco({})).toBeNull()
    expect(montarEndereco({ endereco: null, bairro: null, cidade: null, uf: null, cep: null })).toBeNull()
  })

  it('campo so com espaco conta como vazio', () => {
    expect(montarEndereco({ endereco: '   ', cidade: '  ', uf: ' ' })).toBeNull()
  })
})
