'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { estornarLancamentoAction } from './actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

export function BotaoEstorno({ lancamentoId }: { lancamentoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const chave = useRef(gerarChave())

  if (!aberto) return <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setAberto(true)}>Estornar</button>
  return (
    <form className="d-flex gap-2 align-items-center" onSubmit={(e) => {
      e.preventDefault()
      iniciar(async () => {
        const r = await estornarLancamentoAction(chave.current, lancamentoId, motivo)
        if (r.ok) { setAberto(false); iniciar(() => router.refresh()) }
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <input className="form-control form-control-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do estorno" aria-label="Motivo do estorno" required autoFocus />
      <button type="submit" className="btn btn-danger btn-sm" disabled={pendente}>Confirmar</button>
      <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto(false)}>Voltar</button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </form>
  )
}
