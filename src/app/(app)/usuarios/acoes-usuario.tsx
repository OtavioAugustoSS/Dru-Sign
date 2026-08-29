'use client'
import { ROTULO_PAPEL } from '@/componentes/rotulos'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alterarAtivoUsuarioAction, trocarSenhaAction, alterarUsuarioAction } from './actions'

interface Props {
  id: string
  nome: string
  papel: string
  ativo: boolean
  euMesmo: boolean
}

export function AcoesUsuario(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<'nenhum' | 'senha' | 'editar'>('nenhum')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState(p.nome)
  const [papel, setPapel] = useState(p.papel)

  function rodar(fn: () => ReturnType<typeof trocarSenhaAction>) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) { setErro(null); setAberto('nenhum'); setSenha(''); iniciar(() => router.refresh()) }
      else setErro(r.erro)
    })
  }

  if (aberto === 'senha') {
    return (
      <form className="d-flex gap-2 align-items-center" onSubmit={(e) => { e.preventDefault(); rodar(() => trocarSenhaAction(p.id, senha)) }}>
        <input type="password" className="form-control form-control-sm" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label={`Nova senha de ${p.nome}`} autoComplete="new-password" autoFocus />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pendente}>Gravar senha</button>
        <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto('nenhum')}>Voltar</button>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </form>
    )
  }

  if (aberto === 'editar') {
    return (
      <form className="d-flex gap-2 align-items-center" onSubmit={(e) => { e.preventDefault(); rodar(() => alterarUsuarioAction(p.id, { nome, papel })) }}>
        <input className="form-control form-control-sm" value={nome} onChange={(e) => setNome(e.target.value)} aria-label={`Nome de ${p.nome}`} autoFocus />
        <select className="form-select form-select-sm" value={papel} onChange={(e) => setPapel(e.target.value)} aria-label={`Papel de ${p.nome}`}>
          {Object.entries(ROTULO_PAPEL).map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
        </select>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pendente}>Gravar</button>
        <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto('nenhum')}>Voltar</button>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </form>
    )
  }

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className="btn btn-sm" onClick={() => setAberto('editar')}>Editar</button>
      <button type="button" className="btn btn-sm" onClick={() => setAberto('senha')}>Trocar senha</button>
      {p.euMesmo ? null : (
        <button type="button" className="btn btn-sm btn-ghost-secondary" disabled={pendente}
          onClick={() => rodar(() => alterarAtivoUsuarioAction(p.id, !p.ativo))}>
          {p.ativo ? 'Desativar' : 'Reativar'}
        </button>
      )}
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
