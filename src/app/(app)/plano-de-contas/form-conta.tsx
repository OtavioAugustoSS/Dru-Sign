'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ROTULO_TIPO_CONTA } from '@/domain/caixa/lancamento'
import { criarContaAction } from './actions'

export function FormConta({ grupos }: { grupos: string[] }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [grupo, setGrupo] = useState('')

  return (
    <form className="row g-2 align-items-end" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await criarContaAction({ nome, tipo, grupo })
        if (r.ok) { setNome(''); setTipo(''); setGrupo(''); setErro(null); iniciar(() => router.refresh()) }
        else setErro(r.erro)
      })
    }}>
      <div className="col-md-5"><label className="form-label" htmlFor="nomeConta">Nova conta</label><input id="nomeConta" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="MARKETING DIGITAL" /></div>
      <div className="col-md-2">
        <label className="form-label" htmlFor="tipoConta">Tipo</label>
        <select id="tipoConta" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Escolha</option>
          {(['receita', 'despesa'] as const).map((t) => <option key={t} value={t}>{ROTULO_TIPO_CONTA[t]}</option>)}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label" htmlFor="grupoConta">Grupo</label>
        <input id="grupoConta" className="form-control" list="grupos" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="DESPESAS" />
        <datalist id="grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
      <div className="col-md-2"><button type="submit" className="btn btn-primary w-100" disabled={pendente}>Criar conta</button></div>
      {erro ? <div className="col-12 text-danger-emphasis small" role="alert">{erro}</div> : null}
    </form>
  )
}
