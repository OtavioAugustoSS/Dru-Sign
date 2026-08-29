'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { interpretarMoeda } from '@/domain/precificacao/moeda'
import { ajustarPrecoAction, type Resposta } from './actions'
import { gerarChave } from './chave'

export function FormAjuste({ ordemId, versao, precoFinal, motivo }: { ordemId: string; versao: number; precoFinal: string; motivo: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [invalido, setInvalido] = useState(false)
  const chave = useRef(gerarChave())
  const [preco, setPreco] = useState(precoFinal.replace('.', ','))
  const [texto, setTexto] = useState(motivo)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (pendente) return
        // A mesma leitura da entrada assistida: "2050.50" e dois mil e cinquenta e cinquenta,
        // nao duzentos mil. Ler a virgula na mao aqui ja custou esse zero a mais.
        const valor = interpretarMoeda(preco)
        if (valor === null) { setInvalido(true); setResposta(null); return }
        setInvalido(false)
        iniciar(async () => {
          const r = await ajustarPrecoAction(ordemId, versao, chave.current, valor.toFixed(2), texto)
          setResposta(r)
          if (r.ok) { chave.current = gerarChave(); iniciar(() => router.refresh()) }
          else if (r.conflito) router.refresh()
          else chave.current = gerarChave()
        })
      }}
      className="d-flex flex-column gap-2"
    >
      <label className="form-label mb-0" htmlFor="precoFinal">Novo preço final</label>
      <div className="input-group">
        <span className="input-group-text">R$</span>
        <input id="precoFinal" className="form-control numero" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
      </div>
      <label className="form-label mb-0" htmlFor="motivoAjuste">Motivo do ajuste</label>
      <input id="motivoAjuste" className="form-control" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="arredondamento comercial, cliente antigo…" required />
      <button type="submit" className="btn" disabled={pendente}>{pendente ? SALVANDO : 'Ajustar preço'}</button>
      {invalido ? <div className="text-danger small" role="alert">Preço inválido. Use 2528,00 ou 2528.</div> : null}
      {resposta && !resposta.ok && !resposta.conflito ? <div className="text-danger small" role="alert">{resposta.erro}</div> : null}
    </form>
  )
}
