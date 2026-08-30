'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alterarAtivaAction, definirContaRecebimentoAction, excluirContaAction } from './actions'

interface Props {
  contaId: string
  nome: string
  ativa: boolean
  receita: boolean
  recebeVendas: boolean
  /** Quantos lancamentos ja usaram a conta. Com zero, excluir e seguro. */
  usos: number
}

/**
 * Desativar, excluir e escolher quem recebe as vendas.
 *
 * A exclusao pergunta na propria linha e diz o nome da conta, igual a de
 * materiais: numa lista de quinze contas parecidas, "Excluir mesmo?" sozinho
 * nao diz qual delas vai embora. Conta que ja tem lancamento nem oferece o
 * botao -- o historico do contador depende dela.
 */
export function AcoesConta({ contaId, nome, ativa, receita, recebeVendas, usos }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  function rodar(fn: () => ReturnType<typeof alterarAtivaAction>) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) { setErro(null); setConfirmando(false); iniciar(() => router.refresh()) } else setErro(r.erro)
    })
  }

  if (confirmando) {
    return (
      <span className="d-inline-flex align-items-center gap-2 justify-content-end">
        <span className="small">Excluir {nome}?</span>
        <button type="button" className="btn btn-sm btn-ghost-danger" disabled={pendente} onClick={() => rodar(() => excluirContaAction(contaId))}>Excluir</button>
        <button type="button" className="btn btn-sm" disabled={pendente} onClick={() => { setConfirmando(false); setErro(null) }}>Cancelar</button>
        {erro ? <span className="text-danger-emphasis small" role="alert">{erro}</span> : null}
      </span>
    )
  }

  return (
    <span className="d-inline-flex align-items-center gap-2 justify-content-end">
      {receita && ativa && !recebeVendas ? (
        <button type="button" className="btn btn-sm" disabled={pendente} onClick={() => rodar(() => definirContaRecebimentoAction(contaId))}>Usar para recebimentos</button>
      ) : null}
      <button type="button" className="btn btn-sm btn-ghost-secondary" disabled={pendente} onClick={() => rodar(() => alterarAtivaAction(contaId, !ativa))}>{ativa ? 'Desativar' : 'Reativar'}</button>
      {usos === 0 && !recebeVendas ? (
        <button type="button" className="btn btn-sm btn-ghost-secondary" onClick={() => setConfirmando(true)}>Excluir</button>
      ) : null}
      {erro ? <span className="text-danger-emphasis small" role="alert">{erro}</span> : null}
    </span>
  )
}
