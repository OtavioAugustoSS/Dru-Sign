import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/infra/auth/usuario-atual'
import { destinoSeguro } from '@/infra/auth/destino'
import { FormEntrar } from './form-entrar'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams
  const destino = destinoSeguro(proximo)
  if (await usuarioAtual()) redirect(destino)

  return (
    <div className="page page-center">
      <main className="container container-tight py-4">
        <div className="text-center mb-4">
          <span className="navbar-brand navbar-brand-autodark h1">DruSign</span>
        </div>
        <div className="card card-md">
          <div className="card-body">
            <h1 className="h2 text-center mb-4">Entrar</h1>
            <FormEntrar proximo={destino} />
          </div>
        </div>
      </main>
    </div>
  )
}
