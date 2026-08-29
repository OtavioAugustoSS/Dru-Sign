import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { carregarFilaProducao } from '@/infra/producao/fila'
import { FilaDeProducao } from './fila-producao'

export const metadata: Metadata = { title: 'Fila de produção' }

export default async function PaginaProducao() {
  const usuario = await exigirUsuario()
  return <FilaDeProducao fila={await carregarFilaProducao(usuario.empresaId)} />
}
