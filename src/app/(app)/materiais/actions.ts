'use server'

import { redirect } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { interpretarMoeda } from '@/domain/precificacao/moeda'
import { cabeEmNumeric12x4 } from '@/domain/precificacao/dinheiro'
import { calcularVenda } from '@/domain/precificacao/familia'
import { criarMaterial, atualizarMaterial, definirAtivo, excluirMaterial, ehUnidadeCobranca, obterMaterial } from '@/infra/materiais/repositorio'
import { obterFamilia, registrarMudancaDePreco } from '@/infra/precificacao/repositorio'

export interface EstadoMaterial {
  erro?: string
  campos?: {
    nome: string
    categoria: string
    preco: string
    custo: string
    familiaPrecoId: string
    precoTravado: boolean
    unidadeCobranca: string
  }
}

export async function salvarMaterial(_estado: EstadoMaterial, formData: FormData): Promise<EstadoMaterial> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const campos = {
    nome: String(formData.get('nome') ?? '').trim(),
    categoria: String(formData.get('categoria') ?? '').trim(),
    preco: String(formData.get('preco') ?? '').trim(),
    custo: String(formData.get('custo') ?? '').trim(),
    familiaPrecoId: String(formData.get('familiaPrecoId') ?? ''),
    precoTravado: formData.get('precoTravado') === '1',
    unidadeCobranca: String(formData.get('unidadeCobranca') ?? ''),
  }

  if (campos.nome === '') return { erro: 'O nome é obrigatório.', campos }
  if (!ehUnidadeCobranca(campos.unidadeCobranca)) return { erro: 'Escolha como o material é cobrado.', campos }

  let custo = null
  if (campos.custo !== '') {
    custo = interpretarMoeda(campos.custo)
    if (custo === null) return { erro: 'Custo inválido. Use, por exemplo, 38,00.', campos }
    if (custo.lt(0)) return { erro: 'O custo não pode ser negativo.', campos }
    if (!cabeEmNumeric12x4(custo)) return { erro: 'Custo com até 4 casas decimais e abaixo de R$ 100.000.000,00.', campos }
  }

  const familia = campos.familiaPrecoId === '' ? null : await obterFamilia(usuario.empresaId, campos.familiaPrecoId)
  if (campos.familiaPrecoId !== '' && familia === null) return { erro: 'Família de preço não encontrada.', campos }

  // Quem manda no preco: familia com custo calcula; travado ou sem custo usa o digitado.
  // A regra e a mesma de `precoEfetivo`, so que aqui ela decide o que vai para o banco.
  let preco
  if (familia !== null && custo !== null && !campos.precoTravado) {
    preco = calcularVenda({
      custo: custo.toFixed(),
      margem: familia.margem.toFixed(),
      arredondamento: familia.arredondamento.toFixed(),
    })
  } else {
    preco = interpretarMoeda(campos.preco)
    if (preco === null) return { erro: 'Preço inválido. Use, por exemplo, 281,00.', campos }
    if (!cabeEmNumeric12x4(preco)) return { erro: 'Preço com até 4 casas decimais e abaixo de R$ 100.000.000,00.', campos }
  }

  const dados = {
    nome: campos.nome,
    categoria: campos.categoria,
    preco,
    custo,
    familiaPrecoId: campos.familiaPrecoId === '' ? null : campos.familiaPrecoId,
    precoTravado: campos.precoTravado,
    unidadeCobranca: campos.unidadeCobranca,
  }

  try {
    if (id) {
      // O preco de antes, para o historico saber de onde veio. Lido antes de gravar.
      const antes = await obterMaterial(usuario.empresaId, id)
      await atualizarMaterial(usuario.empresaId, id, dados)
      if (antes) await registrarMudancaDePreco(usuario.empresaId, id, antes.preco, preco, 'edição manual', usuario.id)
    } else {
      await criarMaterial(usuario.empresaId, dados)
    }
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002') {
      return { erro: `Já existe um material chamado “${campos.nome}”.`, campos }
    }
    throw e
  }
  redirect('/materiais')
}

export async function alternarAtivo(formData: FormData): Promise<void> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const ativo = formData.get('ativo') === '1'
  await definirAtivo(usuario.empresaId, id, ativo)
  redirect('/materiais')
}

/**
 * Tira o material do catalogo de vez.
 *
 * Diferente de desativar: desativar guarda o preco que saiu de linha e pode
 * voltar; excluir e para quem digitou errado ou nao trabalha mais com aquilo.
 * As ordens ja lancadas seguem com o preco e a descricao que gravaram.
 */
export async function excluir(formData: FormData): Promise<void> {
  const usuario = await exigirPapel('administracao')
  await excluirMaterial(usuario.empresaId, String(formData.get('id') ?? ''))
  redirect('/materiais')
}
