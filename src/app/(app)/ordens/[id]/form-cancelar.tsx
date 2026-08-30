'use client'
import { CONFLITO_ORDEM } from '@/componentes/rotulos'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelarOrdemAction } from './actions'
import { gerarChave } from './chave'

export function FormCancelar({ ordemId, versao }: { ordemId: string; versao: number }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const chave = useRef(gerarChave())

  if (!aberto) return <button type="button" className="btn btn-link text-danger-emphasis px-0" onClick={() => setAberto(true)}>Cancelar ordem</button>
  return (
    <form className="d-flex flex-column gap-2" onSubmit={(e) => {
      e.preventDefault()
      iniciar(async () => {
        const r = await cancelarOrdemAction(ordemId, versao, chave.current, motivo)
        if (r.ok) router.push('/ordens')
        else if (r.conflito) { setErro(CONFLITO_ORDEM); router.refresh() }
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <label className="form-label mb-0" htmlFor="motivoCancelamento">Motivo do cancelamento</label>
      <input id="motivoCancelamento" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={pendente}>Confirmar cancelamento</button>
        <button type="button" className="btn btn-link" onClick={() => setAberto(false)}>Voltar</button>
      </div>
      {erro ? <div className="text-danger-emphasis small" role="alert">{erro}</div> : null}
    </form>
  )
}
