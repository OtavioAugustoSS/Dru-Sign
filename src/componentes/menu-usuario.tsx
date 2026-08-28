'use client'

import Dropdown from 'react-bootstrap/Dropdown'
import { IconLogout } from '@tabler/icons-react'

interface Props {
  nome: string
  papel: string
  iniciais: string
  sairAction: () => Promise<void>
}

/** Unico ponto do shell que precisa de JS no navegador: o dropdown. Recebe so props serializaveis. */
export function MenuUsuario({ nome, papel, iniciais, sairAction }: Props) {
  return (
    <Dropdown className="nav-item" drop="up" align="end">
      <Dropdown.Toggle
        as="button"
        bsPrefix="nav-link"
        className="d-flex align-items-center lh-1 text-reset p-0 border-0 bg-transparent w-100"
        aria-label="Abrir menu do usuário"
      >
        <span className="avatar avatar-sm">{iniciais}</span>
        <div className="ps-2 text-start">
          <div>{nome}</div>
          <div className="mt-1 small text-secondary">{papel}</div>
        </div>
      </Dropdown.Toggle>
      <Dropdown.Menu className="dropdown-menu-arrow">
        <form action={sairAction}>
          <button type="submit" className="dropdown-item">
            <IconLogout className="icon dropdown-item-icon" />
            Sair
          </button>
        </form>
      </Dropdown.Menu>
    </Dropdown>
  )
}
