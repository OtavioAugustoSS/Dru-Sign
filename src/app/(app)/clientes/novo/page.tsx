import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { FormCliente } from '../form-cliente'

export const metadata: Metadata = { title: 'Novo cliente' }

export default async function PaginaNovoCliente() {
  await exigirUsuario()
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Clientes</div>
          <h2 className="page-title">Novo cliente</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormCliente />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
