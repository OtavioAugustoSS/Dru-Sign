'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ajustarPrecoAction, type Resposta } from './actions'
import { gerarChave } from './chave'

export function FormAjuste({ ordemId, versao, precoFinal, motivo }: { ordemId: string; versao: number; precoFinal: string; motivo: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const chave = useRef(gerarChave())
  const [preco, setPreco] = useState(precoFinal.replace('.', ','))
  const [texto, setTexto] = useState(motivo)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (pendente) return
        iniciar(async () => {
          const r = await ajustarPrecoAction(ordemId, versao, chave.current, preco.replace(/\./g, '').replace(',', '.'), texto)
          setResposta(r)
          if (r.ok) { chave.current = gerarChave(); iniciar(() => router.refresh()) }
          else if (r.conflito) router.refresh()
          else chave.current = gerarChave()
        })
      }}
      className="d-flex flex-column gap-2"
    >
      <label className="form-label mb-0" htmlFor="precoFinal">Preço final</label>
      <div className="input-group">
        <span className="input-group-text">R$</span>
        <input id="precoFinal" className="form-control numero" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <label className="form-label mb-0" htmlFor="motivoAjuste">Motivo do ajuste</label>
      <input id="motivoAjuste" className="form-control" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="arredondamento comercial, cliente antigo…" required />
      <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? 'Gravando…' : 'Ajustar preço'}</button>
      {resposta && !resposta.ok && !resposta.conflito ? <div className="text-danger small" role="alert">{resposta.erro}</div> : null}
    </form>
  )
}
