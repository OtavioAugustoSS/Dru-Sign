'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { criarOrdem } from '@/infra/ordens/repositorio'

export async function criarOrdemAction(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const estado = formData.get('estado') === 'orcamento' ? 'orcamento' : 'aberta'
  const chave = String(formData.get('chave') ?? '')
  const ordem = await criarOrdem({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave }, { estado })
  redirect(`/ordens/${ordem.id}`)
}
