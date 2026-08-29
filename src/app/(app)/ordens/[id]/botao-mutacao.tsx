'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  acao: (chave: string) => Promise<Resposta>
  rotulo: string
  className?: string
  confirmar?: string
}

export function BotaoMutacao({ acao, rotulo, className = 'btn', confirmar }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className={className} disabled={pendente} aria-label={rotulo}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return
          iniciar(async () => {
            const r = await acao(chave.current)
            if (r.ok) { chave.current = gerarChave(); setErro(null) }
            else if (r.conflito) { setErro('A ordem mudou. Recarregando…'); router.refresh() }
            else { chave.current = gerarChave(); setErro(r.erro) }
          })
        }}>
        {rotulo}
      </button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
