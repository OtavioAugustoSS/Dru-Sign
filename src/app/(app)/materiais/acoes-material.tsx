'use client'

import { useState } from 'react'
import { alternarAtivo, excluir } from './actions'

interface Props {
  id: string
  nome: string
  ativo: boolean
}

/**
 * Desativar e excluir, que são coisas diferentes.
 *
 * Desativar guarda: o preço saiu de linha, some da entrada assistida, mas volta
 * com um clique. Excluir tira do catálogo de vez — é para quem digitou errado ou
 * não trabalha mais com aquele material.
 *
 * A exclusão pergunta antes, na própria linha, em vez de abrir uma caixa por
 * cima da tela. E a pergunta diz o nome do material: numa lista de trinta
 * variações de adesivo, "Excluir mesmo?" sozinho não diz qual delas vai embora.
 */
export function AcoesMaterial({ id, nome, ativo }: Props) {
  const [confirmando, setConfirmando] = useState(false)

  if (confirmando) {
    return (
      <div className="d-flex align-items-center gap-2 justify-content-end">
        <span className="small">Excluir {nome}?</span>
        <form action={excluir}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-sm btn-ghost-danger">Excluir</button>
        </form>
        <button type="button" className="btn btn-sm" onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="d-flex gap-2 justify-content-end">
      <form action={alternarAtivo}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="ativo" value={ativo ? '0' : '1'} />
        <button type="submit" className="btn btn-sm btn-ghost-secondary">
          {ativo ? 'Desativar' : 'Reativar'}
        </button>
      </form>
      <button type="button" className="btn btn-sm btn-ghost-secondary" onClick={() => setConfirmando(true)}>
        Excluir
      </button>
    </div>
  )
}
