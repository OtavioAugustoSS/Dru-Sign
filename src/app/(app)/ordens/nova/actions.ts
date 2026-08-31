'use server'

import { redirect } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { criarOrdem } from '@/infra/ordens/repositorio'

/**
 * A ordem nasce JÁ COM O CABEÇALHO, e não vazia.
 *
 * Antes esta tela criava um registro em branco e mandava a pessoa preencher
 * cliente e prazo na tela seguinte. Duas telas para uma decisão só -- e a ordem
 * existia, com número gasto, antes de alguém dizer de quem ela era. Quem
 * desistia no meio deixava uma ordem órfã com o número queimado.
 *
 * Agora o que se digita aqui vai junto na criação. `criarOrdem` já aceitava os
 * três campos; era esta tela que não os oferecia.
 */
export async function criarOrdemAction(formData: FormData): Promise<void> {
  const usuario = await exigirUsuario()
  const estado = formData.get('estado') === 'orcamento' ? 'orcamento' : 'aberta'
  const chave = String(formData.get('chave') ?? '')

  // Texto vindo de formulário: vazio vira null, e id inválido morre no
  // `criarOrdem`, que confere cliente e responsável contra a empresa.
  const clienteId = String(formData.get('clienteId') ?? '').trim() || null
  const prometidaPara = String(formData.get('prometidaPara') ?? '').trim() || null
  const responsavelId = String(formData.get('responsavelId') ?? '').trim() || undefined

  const ordem = await criarOrdem(
    { empresaId: usuario.empresaId, usuarioId: usuario.id, chave },
    { estado, clienteId, prometidaPara, responsavelId },
  )
  redirect(`/ordens/${ordem.id}`)
}
