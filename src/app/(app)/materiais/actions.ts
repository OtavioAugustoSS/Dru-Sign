'use server'

import { redirect } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { interpretarMoeda } from '@/domain/precificacao/moeda'
import { cabeEmNumeric12x4 } from '@/domain/precificacao/dinheiro'
import { criarMaterial, atualizarMaterial, definirAtivo, excluirMaterial, ehUnidadeCobranca } from '@/infra/materiais/repositorio'

export interface EstadoMaterial {
  erro?: string
  campos?: { nome: string; categoria: string; preco: string; unidadeCobranca: string }
}

export async function salvarMaterial(_estado: EstadoMaterial, formData: FormData): Promise<EstadoMaterial> {
  const usuario = await exigirPapel('administracao')
  const id = String(formData.get('id') ?? '')
  const campos = {
    nome: String(formData.get('nome') ?? '').trim(),
    categoria: String(formData.get('categoria') ?? '').trim(),
    preco: String(formData.get('preco') ?? '').trim(),
    unidadeCobranca: String(formData.get('unidadeCobranca') ?? ''),
  }

  if (campos.nome === '') return { erro: 'O nome é obrigatório.', campos }
  const preco = interpretarMoeda(campos.preco)
  if (preco === null) return { erro: 'Preço inválido. Use, por exemplo, 281,00.', campos }
  if (!cabeEmNumeric12x4(preco)) return { erro: 'Preço com até 4 casas decimais e abaixo de R$ 100.000.000,00.', campos }
  if (!ehUnidadeCobranca(campos.unidadeCobranca)) return { erro: 'Escolha como o material é cobrado.', campos }

  const dados = { nome: campos.nome, categoria: campos.categoria, preco, unidadeCobranca: campos.unidadeCobranca }
  try {
    if (id) await atualizarMaterial(usuario.empresaId, id, dados)
    else await criarMaterial(usuario.empresaId, dados)
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
