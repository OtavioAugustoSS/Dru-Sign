'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { lerFormularioCliente } from '@/infra/clientes/formulario'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente, clientesComTelefone,
  type ClienteResumo, type DadosCliente,
} from '@/infra/clientes/repositorio'

export interface EstadoCliente {
  erro?: string
  /** Quem ja tem um dos telefones digitados. O form mostra e pede confirmacao. */
  duplicados?: ClienteResumo[]
  /** O que foi digitado, para o form nao perder nada ao voltar com aviso. */
  campos?: DadosCliente
}

export async function salvarCliente(_estado: EstadoCliente, formData: FormData): Promise<EstadoCliente> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  const confirmou = formData.get('confirmarDuplicidade') === '1'
  const dados = lerFormularioCliente(formData)

  if (dados.nome === '') {
    return { erro: 'O nome é obrigatório.', campos: dados }
  }

  if (!confirmou) {
    const duplicados = await clientesComTelefone(usuario.empresaId, dados.telefones, id || undefined)
    if (duplicados.length > 0) {
      return { duplicados, campos: dados }
    }
  }

  const salvo = id
    ? await atualizarCliente(usuario.empresaId, id, dados)
    : await criarCliente(usuario.empresaId, dados)
  redirect(`/clientes/${salvo.id}`)
}

export async function arquivar(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  await arquivarCliente(usuario.empresaId, id)
  redirect(`/clientes/${id}`)
}

export async function reativar(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  await reativarCliente(usuario.empresaId, id)
  redirect(`/clientes/${id}`)
}
