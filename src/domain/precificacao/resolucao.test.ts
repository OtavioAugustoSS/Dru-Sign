import { describe, it, expect } from 'vitest'
import { resolverLinha, descreverLinha, lerMedida, proximaUnidade, type MaterialCatalogo } from './resolucao'

const CATALOGO: MaterialCatalogo[] = [
  { id: 'acm', nome: 'ACM 3 mm', preco: '61.0000', unidadeCobranca: 'unidade' },
  { id: 'lona', nome: 'Lona 440 g', preco: '83.0000', unidadeCobranca: 'm2' },
  { id: 'letra', nome: 'Letra caixa PVC 10 mm', preco: '34.0000', unidadeCobranca: 'unidade' },
  { id: 'perfil', nome: 'Perfil de alumínio', preco: '28.0000', unidadeCobranca: 'metro_linear' },
]

function item(texto: string, catalogo: MaterialCatalogo[] = []) {
  const r = resolverLinha(texto, catalogo)
  if (r.tipo !== 'item') throw new Error('esperava item')
  return r
}

const LINHAS_18449 = [
  '06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00',
  '01 PLACA ACM 50 X 50 E ADES/ IMP  62,00',
  '03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00',
  '12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00',
  '06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00',
  '03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00',
]

describe('resolverLinha — as seis linhas da OS 18449, como estao no legado', () => {
  it.each([
    [LINHAS_18449[0]!, 6, 0.6, 0.8, 120.5, '723,00'],
    [LINHAS_18449[1]!, 1, 0.5, 0.5, 62, '62,00'],
    [LINHAS_18449[2]!, 3, 0.51, 0.61, 76, '228,00'],
    [LINHAS_18449[3]!, 12, 0.61, 0.4, 61, '732,00'],
    [LINHAS_18449[4]!, 6, 0.61, 0.61, 93, '558,00'],
    [LINHAS_18449[5]!, 3, 0.5, 0.6, 75, '225,00'],
  ])('%s', (texto, qtd, altura, largura, unitario, total) => {
    const r = item(texto)
    expect(r.quantidade).toBe(qtd)
    expect(r.altura).toBeCloseTo(altura, 4)
    expect(r.largura).toBeCloseTo(largura, 4)
    expect(r.valorUnitario).toBe(unitario)
    expect(r.unidade).toBe('unidade')
    expect(r.pendencias).toEqual([])
    const d = descreverLinha(r)
    expect(d.total).toBe(`R$ ${total}`)
    expect(d.conferencia).toBe(texto.includes(' CD ') ? 'ok' : null)
  })

  it('a soma das seis fecha em 2.528,00', () => {
    const soma = LINHAS_18449.reduce((s, l) => s + item(l).quantidade * item(l).valorUnitario!, 0)
    expect(soma).toBe(2528)
  })

  it('CD com total diferente de qtd x unitario avisa divergencia', () => {
    const r = item('12 PLACAS ACM 61 X 40 61,00 CD 700,00')
    expect(r.totalDigitado).toBe(700)
    expect(descreverLinha(r).conferencia).toBe('diverge')
  })
})

describe('resolverLinha — catalogo, unidade e pendencias', () => {
  it('acha o material pelos tokens e herda a unidade dele', () => {
    const r = item('2 lona 440 1,20x2,40 90,00', CATALOGO)
    expect(r.material?.id).toBe('lona')
    expect(r.unidade).toBe('m2')
    expect(r.origemUnidade).toBe('material')
    expect(descreverLinha(r).total).toBe('R$ 518,40')
  })

  it('ACM cadastrado por unidade: 12 x 61,00 = 732,00 mesmo com medida', () => {
    const r = item('12 placas ACM 61x40 61,00', CATALOGO)
    expect(r.material?.id).toBe('acm')
    expect(r.unidade).toBe('unidade')
    expect(descreverLinha(r).total).toBe('R$ 732,00')
  })

  it('sem valor usa o preco do catalogo e marca a origem', () => {
    const r = item('18 letra caixa PVC', CATALOGO)
    expect(r.material?.id).toBe('letra')
    expect(r.valorUnitario).toBe(34)
    expect(r.valorDoCatalogo).toBe(true)
    expect(r.pendencias).toEqual([])
  })

  it('sufixo /m2 vence a unidade do material; a escolha do operador vence o sufixo', () => {
    const r = item('12 placas ACM 61x40 61,00 /m2', CATALOGO)
    expect(r.unidade).toBe('m2')
    expect(r.origemUnidade).toBe('sufixo')
    const forcado = resolverLinha('12 placas ACM 61x40 61,00 /m2', CATALOGO, { unidadeEscolhida: 'metro_linear' })
    expect(forcado.tipo === 'item' && forcado.unidade).toBe('metro_linear')
  })

  it('material escolhido a mao vence a busca por tokens', () => {
    const r = resolverLinha('12 placas 61x40 61,00', CATALOGO, { materialEscolhido: CATALOGO[3]! })
    expect(r.tipo === 'item' && r.material?.id).toBe('perfil')
    expect(r.tipo === 'item' && r.unidade).toBe('metro_linear')
  })

  it('pendencias: valor, dimensao e quantidade', () => {
    expect(item('3 banner 200x100').pendencias).toEqual(['valor'])
    expect(item('2 lona 440 90,00', CATALOGO).pendencias).toEqual(['dimensao'])
    expect(item('0 placas 10,00').pendencias).toContain('quantidade')
    expect(descreverLinha(item('3 banner 200x100')).total).toBeNull()
  })

  it('descreve a linha como no artboard', () => {
    expect(descreverLinha(item('12 placas ACM 61x40 61,00', CATALOGO)).texto)
      .toBe('qtd 12 · ACM 3 mm · 0,61 × 0,40 m · R$ 61,00/un')
    expect(descreverLinha(item('2 lona 440 1,20x2,40 90,00', CATALOGO)).texto)
      .toBe('qtd 2 · Lona 440 g · 1,20 × 2,40 m · R$ 90,00/m²')
  })
})

describe('resolverLinha — acrescimos com prefixo +', () => {
  it.each([
    ['+instalacao 280', 'instalacao', '', 280],
    ['+deslocamento 34 km 102,00', 'deslocamento', '34 km', 102],
    ['+frete 50', 'frete', '', 50],
    ['+imp 120,00', 'imposto', '', 120],
  ])('%s', (texto, tipo, descricao, valor) => {
    const r = resolverLinha(texto, [])
    expect(r).toMatchObject({ tipo: 'acrescimo', tipoAcrescimo: tipo, descricao, valor, pendencias: [] })
  })

  it('tipo desconhecido e valor ausente sao pendencias', () => {
    expect(resolverLinha('+entrega 50', []).pendencias).toContain('tipo_acrescimo')
    expect(resolverLinha('+frete', []).pendencias).toContain('valor')
  })
})

describe('lerMedida e proximaUnidade', () => {
  it('le centimetros e metros', () => {
    expect(lerMedida('61x40')).toEqual({ altura: 0.61, largura: 0.4 })
    expect(lerMedida('1,35 x 0,75')).toEqual({ altura: 1.35, largura: 0.75 })
    expect(lerMedida('61')).toBeNull()
  })
  it('cicla unidade -> m2 -> metro_linear -> unidade', () => {
    expect(proximaUnidade('unidade')).toBe('m2')
    expect(proximaUnidade('m2')).toBe('metro_linear')
    expect(proximaUnidade('metro_linear')).toBe('unidade')
  })
})
