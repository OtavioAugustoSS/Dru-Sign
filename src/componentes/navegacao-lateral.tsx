'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconAddressBook,
  IconArchive,
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconListCheck,
  IconListTree,
  IconPackage,
  IconTools,
  IconUserCog,
  IconUsers,
} from '@tabler/icons-react'
import { GRUPOS, hrefAtivo, type IconeNavegacao, type ItemNavegacao } from '@/app/(app)/navegacao'

const ICONES: Record<IconeNavegacao, typeof IconListCheck> = {
  fila: IconListCheck,
  ordens: IconFileInvoice,
  clientes: IconUsers,
  carteira: IconAddressBook,
  materiais: IconPackage,
  financeiro: IconCash,
  contador: IconFileSpreadsheet,
  plano: IconListTree,
  producao: IconTools,
  indicadores: IconChartBar,
  usuarios: IconUserCog,
  empresa: IconBuildingStore,
  historico: IconArchive,
}

/**
 * A lateral precisa saber onde a pessoa esta, e isso so existe no navegador --
 * por isso este e o unico pedaco cliente do menu. Recebe os itens ja filtrados
 * pelo papel, entao o que a pessoa nao pode ver nem chega ao navegador.
 */
export function NavegacaoLateral({ itens }: { itens: ItemNavegacao[] }) {
  const caminho = usePathname() ?? '/'
  const ativo = hrefAtivo(caminho, itens.map((i) => i.href))

  const linha = (item: ItemNavegacao) => {
    const Icone = ICONES[item.icone]
    const aceso = ativo === item.href
    return (
      <li className={aceso ? 'nav-item active' : 'nav-item'} key={item.href}>
        <Link className="nav-link" href={item.href} aria-current={aceso ? 'page' : undefined}>
          <span className="nav-link-icon d-md-none d-lg-inline-block">
            <Icone className="icon" />
          </span>
          <span className="nav-link-title">{item.titulo}</span>
        </Link>
      </li>
    )
  }

  const soltos = itens.filter((i) => !i.grupo)

  return (
    <nav aria-label="Principal" className="navbar-collapse lateral-navegacao">
      {soltos.length > 0 ? <ul className="navbar-nav flex-grow-0 pt-lg-3">{soltos.map(linha)}</ul> : null}

      {GRUPOS.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo.chave)
        // Quem e da operacao nao ve Financeiro nem Configuracao: o cabecalho de
        // um grupo vazio seria uma porta para lugar nenhum.
        if (doGrupo.length === 0) return null
        const id = `grupo-${grupo.chave}`
        return (
          <div className="mt-3" key={grupo.chave}>
            <div className="lateral-grupo px-3 pb-1 small fw-bold text-uppercase text-secondary" id={id}>
              {grupo.rotulo}
            </div>
            <ul className="navbar-nav" aria-labelledby={id}>
              {doGrupo.map(linha)}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
