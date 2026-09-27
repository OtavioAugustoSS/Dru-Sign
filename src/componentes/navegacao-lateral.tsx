'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconAddressBook,
  IconLayoutDashboard,
  IconArchive,
  IconBuildingStore,
  IconCalculator,
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
  painel: IconLayoutDashboard,
  fila: IconListCheck,
  ordens: IconFileInvoice,
  clientes: IconUsers,
  carteira: IconAddressBook,
  materiais: IconPackage,
  precificacao: IconCalculator,
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

  /*
   * A BARRA QUE ACOMPANHA O ITEM EM VIGOR.
   *
   * O Tabler marca o item aceso com um `::after` de `border-left: 3px`. Aquilo
   * nao tem como deslizar: o pseudo-elemento so EXISTE no item ativo (nos outros
   * o `content` e `none`), entao ele nao se move de um para o outro -- ele
   * aparece num e desaparece do outro. Aqui a barra passa a ser um elemento so,
   * que vive na lista inteira e muda de lugar.
   *
   * Precisa de medida, e nao da para ser CSS puro como foi nas abas: os catorze
   * itens tem a mesma altura (40px), mas os cabecalhos de grupo abrem vaos de 77
   * e 78px no meio deles, entao a posicao nao sai de uma conta com o indice.
   * Duas propriedades personalizadas resolvem, e o CSS faz o resto -- so
   * `transform` anima, nada que cause layout.
   *
   * `useLayoutEffect` e nao `useEffect`: a medida precisa estar escrita antes da
   * pintura, senao a barra aparece no lugar velho por um quadro e pisca.
   */
  const nav = useRef<HTMLElement>(null)
  const [temBarra, setTemBarra] = useState(false)

  useLayoutEffect(() => {
    const raiz = nav.current
    if (!raiz) return
    const item = raiz.querySelector<HTMLElement>('.nav-item.active')
    if (!item) {
      setTemBarra(false)
      return
    }
    raiz.style.setProperty('--barra-y', `${item.offsetTop}px`)
    raiz.style.setProperty('--barra-altura', `${item.offsetHeight}px`)
    setTemBarra(true)
  }, [ativo, itens])

  /*
   * A PRIMEIRA PINTURA NAO DESLIZA.
   *
   * Sem isto, abrir o sistema mostraria a barra saindo do topo da lista ate o
   * item certo -- movimento que nao informa nada, porque nao houve troca
   * nenhuma. A transicao so entra depois que a barra ja esta no lugar.
   */
  const [podeDeslizar, setPodeDeslizar] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setPodeDeslizar(true))
    return () => cancelAnimationFrame(t)
  }, [])

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
    <nav aria-label="Principal" className="navbar-collapse lateral-navegacao" ref={nav}>
      {/* aria-hidden: quem usa leitor de tela ja recebe o `aria-current="page"`
          do link. A barra e a mesma informacao, para quem enxerga. */}
      {temBarra ? (
        <span className={podeDeslizar ? 'lateral-barra desliza' : 'lateral-barra'} aria-hidden="true" />
      ) : null}
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
