import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterCliente } from '@/infra/clientes/repositorio'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { FormCliente } from '../../form-cliente'

export const metadata: Metadata = { title: 'Editar cliente' }

export default async function PaginaEditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const c = await obterCliente(usuario.empresaId, id)
  if (!c) notFound()

  return (
    <>
      <CabecalhoPagina voltar={{ href: `/clientes/${c.id}`, rotulo: c.nome }} titulo={`Editar ${c.nome}`} />
      <CorpoPagina>
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
      </CorpoPagina>
    </>
  )
}
