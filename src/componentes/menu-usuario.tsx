'use client'

import Dropdown from 'react-bootstrap/Dropdown'
import { IconLogout } from '@tabler/icons-react'
import { SeletorTema } from './seletor-tema'
import type { Tema } from '@/infra/tema/preferencia'

interface Props {
  nome: string
  papel: string
  iniciais: string
  tema: Tema
  sairAction: () => Promise<void>
  escolherTemaAction: (valor: string) => Promise<void>
}

/**
 * Unico ponto do shell que precisa de JS no navegador: o dropdown. Recebe so
 * props serializaveis.
 *
 * Alinhamento: o `p-0` que estava aqui tirava o recuo de 1rem que TODO item da
 * lateral tem, e o Tabler centraliza o conteudo do `.nav-item` -- entao o avatar
 * caia em x=47 enquanto os icones do menu ficam em x=16. A linha do perfil saia
 * torta em relacao ao resto da barra. Sem o `p-0`, o proprio `.nav-link` da o
 * recuo certo; o `justify-content-start` desfaz a centralizacao.
 */
export function MenuUsuario({ nome, papel, iniciais, tema, sairAction, escolherTemaAction }: Props) {
  return (
    <Dropdown className="nav-item" drop="up" align="end">
      <Dropdown.Toggle
        as="button"
        bsPrefix="nav-link"
        className="d-flex align-items-center justify-content-start text-start lh-1 text-reset border-0 bg-transparent w-100 px-3 py-2"
        aria-label="Abrir menu do usuário"
      >
        <span className="avatar avatar-xs">{iniciais}</span>
        <div className="ps-1 text-start">
          <div>{nome}</div>
          <div className="mt-1 small text-secondary">{papel}</div>
        </div>
      </Dropdown.Toggle>
      <Dropdown.Menu className="dropdown-menu-arrow">
        <SeletorTema inicial={tema} escolherAction={escolherTemaAction} />
        <div className="dropdown-divider" />
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
