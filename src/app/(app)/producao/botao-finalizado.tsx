'use client'
import { CONFLITO_ORDEM, SALVANDO } from '@/componentes/rotulos'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finalizarServicoAction } from './actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

/** Alvo de toque grande: a producao usa isto de pe, as vezes de luva (spec, tela 8). */
export function BotaoFinalizado({ ordemId, versao }: { ordemId: string; versao: number }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())

  return (
    <>
      <button type="button" className="btn btn-success w-100 py-3 fs-3 botao-producao" disabled={pendente}
        onClick={() => {
          if (pendente) return
          iniciar(async () => {
            const r = await finalizarServicoAction(ordemId, versao, chave.current)
            if (r.ok) { chave.current = gerarChave(); setErro(null); iniciar(() => router.refresh()) }
            else if (r.conflito) { setErro(CONFLITO_ORDEM); router.refresh() }
            else { chave.current = gerarChave(); setErro(r.erro) }
          })
        }}>
        {pendente ? SALVANDO : 'Serviço finalizado'}
      </button>
      {erro ? <div className="text-danger-emphasis mt-2" role="alert">{erro}</div> : null}
    </>
  )
}
