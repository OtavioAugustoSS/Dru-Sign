import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/infra/db/prisma'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente,
  obterCliente, buscarClientes, clientesComTelefone,
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

    const dup = await clientesComTelefone(empresaId, ['38999681168', '(38)3676-6222'])
    expect(dup.map((c) => c.nome).sort()).toEqual(['A', 'B'])
    expect((await clientesComTelefone(empresaId, ['38999681168'], a.id)).map((c) => c.nome)).toEqual([])
    expect(await clientesComTelefone(empresaId, ['123', ''])).toEqual([])
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
