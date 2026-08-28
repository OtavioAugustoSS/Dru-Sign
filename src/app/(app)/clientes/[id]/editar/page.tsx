import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterCliente } from '@/infra/clientes/repositorio'
import { FormCliente } from '../../form-cliente'

export const metadata: Metadata = { title: 'Editar cliente' }

export default async function PaginaEditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const c = await obterCliente(usuario.empresaId, id)
  if (!c) notFound()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Cliente</div>
          <h2 className="page-title">Editar {c.nome}</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormCliente
                id={c.id}
                inicial={{
                  nome: c.nome, apelido: c.apelido, documento: c.documento, email: c.email, contato: c.contato,
                  endereco: c.endereco, bairro: c.bairro, cidade: c.cidade, uf: c.uf, cep: c.cep,
                  observacoes: c.observacoes, telefones: c.telefones.map((t) => t.original),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
