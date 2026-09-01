import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente,
  obterCliente, buscarClientes, clientesParecidos,
} from './repositorio'

let empresaId = ''

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  empresaId = empresa.id
})

describe('clientes (banco real)', () => {
  it('cria com telefones normalizados e documento so em digitos', async () => {
    const c = await criarCliente(empresaId, {
      nome: 'Associação de Ensino e Pesquisa de Unaí',
      apelido: 'FACTU',
      documento: '00.150.991/0001-99',
      telefones: ['(38)3676-6222', '(38)9968-1168', ''],
    })
    expect(c.documento).toBe('00150991000199')
    expect(c.telefones).toEqual([
      { original: '(38)3676-6222', normalizado: '3836766222', inferido: false },
      { original: '(38)9968-1168', normalizado: '38999681168', inferido: true },
    ])
  })

  it('busca por apelido, por nome e por telefone, sem diferenciar caixa', async () => {
    await criarCliente(empresaId, { nome: 'CENCOSUD BRASIL COMERCIAL', apelido: 'BRETAS', telefones: [] })
    await criarCliente(empresaId, { nome: 'Sandra Hofig de Barros', apelido: 'Fazenda HJ', telefones: ['(38)9968-1168'] })

    expect((await buscarClientes(empresaId, 'bretas')).map((c) => c.nome)).toEqual(['CENCOSUD BRASIL COMERCIAL'])
    expect((await buscarClientes(empresaId, 'cencosud')).map((c) => c.apelido)).toEqual(['BRETAS'])
    expect((await buscarClientes(empresaId, '99681168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    expect((await buscarClientes(empresaId, '(38) 99968-1168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    // Como esta no cartao do legado, sem o nono digito: precisa achar mesmo assim.
    expect((await buscarClientes(empresaId, '(38)9968-1168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    expect((await buscarClientes(empresaId, '3899681168')).map((c) => c.nome)).toEqual(['Sandra Hofig de Barros'])
    expect(await buscarClientes(empresaId, 'ninguem')).toEqual([])
  })

  it('sem termo, lista por nome com limite', async () => {
    await criarCliente(empresaId, { nome: 'Zeta', telefones: [] })
    await criarCliente(empresaId, { nome: 'Alfa', telefones: [] })
    await criarCliente(empresaId, { nome: 'Beta', telefones: [] })
    expect((await buscarClientes(empresaId, '', { limite: 2 })).map((c) => c.nome)).toEqual(['Alfa', 'Beta'])
  })

  it('aponta duplicidade por telefone, ignorando o proprio cliente', async () => {
    const a = await criarCliente(empresaId, { nome: 'A', telefones: ['(38)9968-1168'] })
    await criarCliente(empresaId, { nome: 'B', telefones: ['(38)3676-6222'] })

    const dup = await clientesParecidos(empresaId, { telefones: ['38999681168', '(38)3676-6222'] })
    expect(dup.map((d) => d.cliente.nome).sort()).toEqual(['A', 'B'])
    expect(dup.every((d) => d.motivos.includes('telefone'))).toBe(true)
    expect((await clientesParecidos(empresaId, { telefones: ['38999681168'] }, a.id))).toEqual([])
    expect(await clientesParecidos(empresaId, { telefones: ['123', ''] })).toEqual([])
  })

  /*
   * O nome entrou como segundo sinal depois do telefone: 108 grupos de nome
   * repetido na base real. Nome PARECIDO ficou de fora (disparava em 29,9% dos
   * cadastros) e documento tambem -- ver o comentario de `clientesParecidos`.
   */
  it('aponta duplicidade por nome igual sem diferenciar caixa, mas nao por nome parecido', async () => {
    await criarCliente(empresaId, { nome: 'MARCENARIA UNAI', telefones: [] })

    const porNome = await clientesParecidos(empresaId, { nome: 'Marcenaria Unai', telefones: [] })
    expect(porNome.map((d) => [d.cliente.nome, d.motivos])).toEqual([['MARCENARIA UNAI', ['nome']]])

    expect(await clientesParecidos(empresaId, { nome: 'MARCENARIA UNAI LTDA', telefones: [] })).toEqual([])
  })

  /*
   * A fazenda nova do mesmo CPF NAO e duplicidade: e como a loja trabalha. Um
   * produtor tem varias fazendas, cada uma com endereco e servico proprios, e a
   * Prefeitura tem uma secretaria por empenho. Se este teste comecar a acusar
   * duplicidade, alguem religou o sinal de documento sem medir de novo.
   */
  it('mesmo documento, nome e telefone diferentes: nao e duplicidade', async () => {
    await criarCliente(empresaId, { nome: 'CELSO MANICA FAZ SANTO ANTONIO', documento: '529.179.836-04', telefones: ['(38)99111-0001'] })
    const r = await clientesParecidos(empresaId, { nome: 'CELSO MANICA FAZ VALE VERDE', telefones: ['(38)99111-0002'] })
    expect(r).toEqual([])
  })

  it('quando nome e telefone batem no mesmo cadastro, os dois motivos aparecem', async () => {
    await criarCliente(empresaId, { nome: 'Vidracaria do Vale', telefones: ['(38)3676-6222'] })
    const r = await clientesParecidos(empresaId, { nome: 'VIDRACARIA DO VALE', telefones: ['3836766222'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.motivos.sort()).toEqual(['nome', 'telefone'])
  })

  it('atualiza dados e troca a lista de telefones', async () => {
    const c = await criarCliente(empresaId, { nome: 'Antigo', telefones: ['(38)9968-1168'] })
    const d = await atualizarCliente(empresaId, c.id, { nome: 'Novo', apelido: 'N', telefones: ['(38)3676-6222'] })
    expect(d.nome).toBe('Novo')
    expect(d.telefones.map((t) => t.normalizado)).toEqual(['3836766222'])
    expect(await prisma.telefoneCliente.count({ where: { clienteId: c.id } })).toBe(1)
  })

  it('arquiva e reativa sem apagar; arquivado some da busca por padrao', async () => {
    const c = await criarCliente(empresaId, { nome: 'Some', telefones: [] })
    await arquivarCliente(empresaId, c.id)
    expect((await obterCliente(empresaId, c.id))?.arquivadoEm).not.toBeNull()
    expect(await buscarClientes(empresaId, 'some')).toEqual([])
    expect((await buscarClientes(empresaId, 'some', { incluirArquivados: true })).map((x) => x.nome)).toEqual(['Some'])
    await reativarCliente(empresaId, c.id)
    expect((await obterCliente(empresaId, c.id))?.arquivadoEm).toBeNull()
  })

  it('nao enxerga cliente de outra empresa', async () => {
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const c = await criarCliente(outra.id, { nome: 'Alheio', telefones: [] })
    expect(await obterCliente(empresaId, c.id)).toBeNull()
    expect(await buscarClientes(empresaId, 'alheio')).toEqual([])
  })
})
