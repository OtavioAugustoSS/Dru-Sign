'use client'
import { DESCRICAO_PAPEL, SALVANDO } from '@/componentes/rotulos'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarUsuarioAction } from './actions'

const PAPEIS = Object.entries(DESCRICAO_PAPEL)

export function FormUsuario() {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [papel, setPapel] = useState('')
  const [senha, setSenha] = useState('')

  return (
    <form className="row g-2 align-items-end" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await criarUsuarioAction({ nome, login, papel, senha })
        if (r.ok) { setNome(''); setLogin(''); setPapel(''); setSenha(''); setErro(null); iniciar(() => router.refresh()) }
        else setErro(r.erro)
      })
    }}>
      <div className="col-md-3"><label className="form-label" htmlFor="nomeUsuario">Nome</label><input id="nomeUsuario" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pedro Souza" /></div>
      <div className="col-md-2"><label className="form-label" htmlFor="loginUsuario">Login</label><input id="loginUsuario" className="form-control" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="pedro" autoComplete="off" /></div>
      <div className="col-md-3">
        <label className="form-label" htmlFor="papelUsuario">Papel</label>
        <select id="papelUsuario" className="form-select" value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="">Escolha o papel</option>
          {PAPEIS.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
        </select>
      </div>
      <div className="col-md-2"><label className="form-label" htmlFor="senhaUsuario">Senha inicial</label><input id="senhaUsuario" type="password" className="form-control" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></div>
      <div className="col-md-2"><button type="submit" className="btn btn-primary w-100" disabled={pendente}>{pendente ? SALVANDO : 'Criar usuário'}</button></div>
      <div className="col-12 form-hint">A pessoa entra com essa senha e troca depois. Mínimo de 8 caracteres.</div>
      {erro ? <div className="col-12 text-danger small" role="alert">{erro}</div> : null}
    </form>
  )
}
