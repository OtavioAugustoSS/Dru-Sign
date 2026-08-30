'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Offcanvas from 'react-bootstrap/Offcanvas'
import { IconMenu2 } from '@tabler/icons-react'
import { NavegacaoLateral } from './navegacao-lateral'
import type { ItemNavegacao } from '@/app/(app)/navegacao'

interface Props {
  itens: ItemNavegacao[]
  /** O menu do usuario, montado no servidor e mostrado nos dois lugares. */
  menuUsuario: ReactNode
}

/**
 * A casca da lateral em duas formas.
 *
 * Ate aqui existia uma so, e abaixo de 992px o Tabler desliga o posicionamento
 * fixo: o menu inteiro empilhava ACIMA do conteudo. Em 390px eram 823px de menu
 * antes da primeira linha util, em toda tela, sem como fechar.
 *
 * Agora: em telas largas, a lateral fixa de sempre. Em telas estreitas, uma
 * barra de topo com botao, e o menu numa gaveta que fecha sozinha quando a
 * pessoa navega -- senao ela escolhe um item e continua olhando para o menu.
 */
export function CascaLateral({ itens, menuUsuario }: Props) {
  const [aberto, setAberto] = useState(false)
  const caminho = usePathname()

  useEffect(() => {
    setAberto(false)
  }, [caminho])

  const marca = (
    <Link href="/" className="text-reset text-decoration-none">
      DruSign
    </Link>
  )

  return (
    <>
      {/* Barra de topo: so existe onde a lateral fixa nao cabe. */}
      <header className="navbar navbar-expand-lg d-lg-none sticky-top d-print-none">
        {/* `justify-content-start`: a marca fica ao lado do botao, nao na ponta
            oposta. O par "menu + onde estou" se le como uma coisa so. */}
        <div className="container-fluid gap-2 justify-content-start">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            aria-expanded={aberto}
            aria-controls="menu-lateral"
          >
            <IconMenu2 className="icon" />
          </button>
          <div className="navbar-brand navbar-brand-autodark m-0">{marca}</div>
        </div>
      </header>

      <aside className="navbar navbar-vertical navbar-expand-lg d-none d-lg-flex d-print-none">
        {/* `lateral-casca` prende a coluna a altura da janela. Sem isso, numa
            janela baixa (medido a 768px) o conteudo empurrava a barra para fora
            da tela em vez de rolar por dentro dela. */}
        <div className="container-fluid lateral-casca">
          <div className="navbar-brand navbar-brand-autodark">{marca}</div>
          <NavegacaoLateral itens={itens} />
          <div className="navbar-nav lateral-usuario flex-grow-0 py-2">{menuUsuario}</div>
        </div>
      </aside>

      <Offcanvas
        show={aberto}
        onHide={() => setAberto(false)}
        placement="start"
        id="menu-lateral"
        aria-label="Menu"
        className="d-lg-none"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="navbar-brand navbar-brand-autodark m-0">{marca}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column">
          <NavegacaoLateral itens={itens} />
          <div className="navbar-nav lateral-usuario flex-grow-0 mt-auto pt-3">{menuUsuario}</div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  )
}
