import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterMaterial } from '@/infra/materiais/repositorio'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { FormMaterial } from '../form-material'

export const metadata: Metadata = { title: 'Editar material' }

export default async function PaginaEditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { id } = await params
  const m = await obterMaterial(usuario.empresaId, id)
  if (!m) notFound()

  return (
    <>
      <CabecalhoPagina pretitulo="Materiais e preços" titulo={`Editar ${m.nome}`} />
      <CorpoPagina>
        <div className="card">
          <div className="card-body">
            <FormMaterial
              id={m.id}
              inicial={{ nome: m.nome, categoria: m.categoria ?? '', preco: m.preco.toFixed(2).replace('.', ','), unidadeCobranca: m.unidadeCobranca }}
            />
          </div>
        </div>
      </CorpoPagina>
    </>
  )
}
