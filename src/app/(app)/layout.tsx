import Link from 'next/link'
import { IconListCheck, IconUsers, IconPackage, IconFileInvoice, IconCash, IconListTree, IconTools, IconChartBar, IconUserCog, IconBuildingStore, IconArchive } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { MenuUsuario } from '@/componentes/menu-usuario'
import { sair } from '@/app/(auth)/entrar/actions'
import { escolherTema } from '@/app/acoes-tema'
import { lerTemaDoCookie } from '@/infra/tema/cookie'
import { NAVEGACAO } from './navegacao'

const ICONES = {
  fila: <IconListCheck className="icon" />,
  ordens: <IconFileInvoice className="icon" />,
  clientes: <IconUsers className="icon" />,
  materiais: <IconPackage className="icon" />,
  financeiro: <IconCash className="icon" />,
  plano: <IconListTree className="icon" />,
  producao: <IconTools className="icon" />,
  operacao: <IconChartBar className="icon" />,
  usuarios: <IconUserCog className="icon" />,
  empresa: <IconBuildingStore className="icon" />,
  historico: <IconArchive className="icon" />,
} as const

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
  const [usuario, tema] = await Promise.all([exigirUsuario(), lerTemaDoCookie()])

  return (
    <div className="page">
      <aside className="navbar navbar-vertical navbar-expand-lg">
        <div className="container-fluid">
          <div className="navbar-brand navbar-brand-autodark">
            <Link href="/">DruSign</Link>
          </div>

          <nav aria-label="Principal" className="navbar-collapse">
            <ul className="navbar-nav pt-lg-3">
              {NAVEGACAO.filter((item) => !item.papel || item.papel === usuario.papel).map((item) => (
                <li className="nav-item" key={item.href}>
                  <Link className="nav-link" href={item.href}>
                    <span className="nav-link-icon d-md-none d-lg-inline-block">{ICONES[item.icone]}</span>
                    <span className="nav-link-title">{item.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="navbar-nav mt-auto pb-lg-3">
            <MenuUsuario
              nome={usuario.nome}
              papel={PAPEL_LEGIVEL[usuario.papel]}
              iniciais={iniciais(usuario.nome)}
              tema={tema}
              sairAction={sair}
              escolherTemaAction={escolherTema}
            />
          </div>
        </div>
      </aside>

      <div className="page-wrapper">{children}</div>
    </div>
  )
}
