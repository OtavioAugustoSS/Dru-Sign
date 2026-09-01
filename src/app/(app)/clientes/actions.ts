'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { lerFormularioCliente } from '@/infra/clientes/formulario'
import { validarDadosCliente } from '@/infra/clientes/validacao'
import {
  criarCliente, atualizarCliente, arquivarCliente, reativarCliente, clientesParecidos,
  type ClienteParecido, type DadosCliente,
} from '@/infra/clientes/repositorio'

export interface EstadoCliente {
  erro?: string
  /** Quem ja pode ser esta pessoa, e por que. O form mostra e pede confirmacao. */
  duplicados?: ClienteParecido[]
  /** O que foi digitado, para o form nao perder nada ao voltar com aviso. */
  campos?: DadosCliente
}

export async function salvarCliente(_estado: EstadoCliente, formData: FormData): Promise<EstadoCliente> {
  const usuario = await exigirUsuario()
  const id = String(formData.get('id') ?? '')
  const confirmou = formData.get('confirmarDuplicidade') === '1'
  const dados = lerFormularioCliente(formData)

  const erro = validarDadosCliente(dados)
  if (erro) {
    return { erro, campos: dados }
  }

  if (!confirmou) {
    const duplicados = await clientesParecidos(usuario.empresaId, dados, id || undefined)
    if (duplicados.length > 0) {
      return { duplicados, campos: dados }
    }
  }

  let salvoId: string
  try {
    const salvo = id
      ? await atualizarCliente(usuario.empresaId, id, dados)
      : await criarCliente(usuario.empresaId, dados)
    salvoId = salvo.id
  } catch (e) {
    // Erro do banco (tamanho, conexao): devolve o formulario com o que foi digitado, em vez de uma pagina 500.
    if (typeof e === 'object' && e !== null && 'code' in e) {
      return { erro: 'Não foi possível salvar. Confira os campos e tente de novo.', campos: dados }
    }
    throw e
  }
  redirect(`/clientes/${salvoId}`) // fora do try: redirect() lanca NEXT_REDIRECT
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
