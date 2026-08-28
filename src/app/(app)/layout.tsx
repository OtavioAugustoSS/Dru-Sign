import Link from 'next/link'
import { IconListCheck } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { MenuUsuario } from '@/componentes/menu-usuario'
import { sair } from '@/app/(auth)/entrar/actions'

const PAPEL_LEGIVEL = { administracao: 'Administração', operacao: 'Operação' } as const

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()

  return (
    <div className="page">
      <aside className="navbar navbar-vertical navbar-expand-lg">
        <div className="container-fluid">
          <div className="navbar-brand navbar-brand-autodark">
            <Link href="/">DruSign</Link>
          </div>

          <nav aria-label="Principal" className="navbar-collapse">
            <ul className="navbar-nav pt-lg-3">
              <li className="nav-item">
                <Link className="nav-link" href="/">
                  <span className="nav-link-icon d-md-none d-lg-inline-block">
                    <IconListCheck className="icon" />
                  </span>
                  <span className="nav-link-title">Fila de trabalho</span>
                </Link>
              </li>
            </ul>
          </nav>

          <div className="navbar-nav mt-auto pb-lg-3">
            <MenuUsuario
              nome={usuario.nome}
              papel={PAPEL_LEGIVEL[usuario.papel]}
              iniciais={iniciais(usuario.nome)}
              sairAction={sair}
            />
          </div>
        </div>
      </aside>

      <div className="page-wrapper">{children}</div>
    </div>
  )
}
