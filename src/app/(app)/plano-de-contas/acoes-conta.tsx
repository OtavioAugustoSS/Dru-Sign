'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alterarAtivaAction, definirContaRecebimentoAction } from './actions'

export function AcoesConta({ contaId, ativa, receita, recebeVendas }: { contaId: string; ativa: boolean; receita: boolean; recebeVendas: boolean }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  function rodar(fn: () => ReturnType<typeof alterarAtivaAction>) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) { setErro(null); iniciar(() => router.refresh()) } else setErro(r.erro)
    })
  }
  return (
    <span className="d-inline-flex align-items-center gap-2">
      {receita && ativa && !recebeVendas ? <button type="button" className="btn btn-sm" disabled={pendente} onClick={() => rodar(() => definirContaRecebimentoAction(contaId))}>Usar para recebimentos</button> : null}
      <button type="button" className="btn btn-sm btn-ghost-secondary" disabled={pendente} onClick={() => rodar(() => alterarAtivaAction(contaId, !ativa))}>{ativa ? 'Desativar' : 'Reativar'}</button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
