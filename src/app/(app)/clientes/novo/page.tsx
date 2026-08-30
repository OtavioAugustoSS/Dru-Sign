import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { FormCliente } from '../form-cliente'

export const metadata: Metadata = { title: 'Novo cliente' }

export default async function PaginaNovoCliente() {
  await exigirUsuario()
  return (
    <>
      <CabecalhoPagina voltar={{ href: '/clientes', rotulo: 'Clientes' }} titulo="Novo cliente" />
      <CorpoPagina>
        <div className="card">
          <div className="card-body">
            <FormCliente />
          </div>
        </div>
      </CorpoPagina>
    </>
  )
}
