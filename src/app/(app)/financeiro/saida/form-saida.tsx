'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registrarSaidaAction } from '../actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

interface Props {
  hoje: string
  contas: Array<{ id: string; codigo: number; nome: string; grupo: string }>
}

export function FormSaida({ hoje, contas }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())
  const [data, setData] = useState(hoje)
  const [valor, setValor] = useState('')
  const [contaId, setContaId] = useState('')
  const [historico, setHistorico] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [parcela, setParcela] = useState('')
  const [totalParcelas, setTotalParcelas] = useState('')
  const grupos = [...new Set(contas.map((c) => c.grupo))]

  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await registrarSaidaAction(chave.current, { valor, data, historico, contaId, fornecedor, parcela, totalParcelas })
        if (r.ok) router.push('/financeiro')
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <div className="card-body row g-3">
        <div className="col-md-3"><label className="form-label" htmlFor="data">Data</label><input id="data" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="valor">Valor</label>
          <div className="input-group"><span className="input-group-text">R$</span><input id="valor" className="form-control numero" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="conta">Conta</label>
          <select id="conta" className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Escolha a conta</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                {contas.filter((c) => c.grupo === g).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-md-8"><label className="form-label" htmlFor="historico">Histórico</label><input id="historico" className="form-control" value={historico} onChange={(e) => setHistorico(e.target.value)} placeholder="Chapa ACM, solvente, mídia" /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="fornecedor">Fornecedor</label><input id="fornecedor" className="form-control" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="opcional" /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="parcela">Parcela</label><input id="parcela" className="form-control numero" inputMode="numeric" value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="2" /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="totalParcelas">de</label><input id="totalParcelas" aria-label="Total de parcelas" className="form-control numero" inputMode="numeric" value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="3" /></div>
        <div className="col-12 form-hint">A compra parcelada entra uma vez por parcela, cada uma na sua data. Vazio quando não é parcelado.</div>
      </div>
      <div className="card-footer d-flex align-items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? SALVANDO : 'Lançar saída'}</button>
        <a href="/financeiro" className="btn btn-link">Cancelar</a>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </div>
    </form>
  )
}
