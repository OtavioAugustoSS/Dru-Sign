'use client'

import Dropdown from 'react-bootstrap/Dropdown'
import { IconChevronUp, IconLogout } from '@tabler/icons-react'

interface Props {
  nome: string
  papel: string
  iniciais: string
  sairAction: () => Promise<void>
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
export function MenuUsuario({ nome, papel, iniciais, sairAction }: Props) {
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
        {/* A seta e o que diz que isto ABRE alguma coisa. Sem ela, o unico
            caminho para trocar o tema e para sair era descobrir por tentativa
            que aquele nome no rodape era clicavel -- e o Otavio, procurando o
            perfil, achou que ele tinha sumido. */}
        <IconChevronUp className="icon ms-auto text-secondary" aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="dropdown-menu-arrow">
        {/* Só "Sair". O seletor de tema morava aqui e saiu junto com o modo
            claro: sem duas faces para escolher, o menu tinha três opções que
            faziam a mesma coisa. */}
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
