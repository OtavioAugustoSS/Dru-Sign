import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterMaterial } from '@/infra/materiais/repositorio'
import { FormMaterial } from '../form-material'

export const metadata: Metadata = { title: 'Editar material' }

export default async function PaginaEditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { id } = await params
  const m = await obterMaterial(usuario.empresaId, id)
  if (!m) notFound()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Materiais e preços</div>
          <h2 className="page-title">Editar {m.nome}</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <FormMaterial
                id={m.id}
                inicial={{ nome: m.nome, categoria: m.categoria ?? '', preco: m.preco.toFixed(2).replace('.', ','), unidadeCobranca: m.unidadeCobranca }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
