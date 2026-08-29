'use client'
import { SALVANDO } from '@/componentes/rotulos'
import { SeloApelido } from '@/componentes/selo'

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ClienteResumo } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { atualizarCabecalhoAction, buscarClientesAction, type Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  versao: number
  cliente: { id: string | null; nome: string; apelido: string | null } | null
  prometidaPara: string | null
  responsavelId: string
  usuarios: Array<{ id: string; nome: string }>
  observacoes: string | null
  somenteObservacoes: boolean
}

export function FormCabecalho(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const chave = useRef(gerarChave())
  const [clienteId, setClienteId] = useState<string | null>(p.cliente?.id ?? null)
  const [clienteNome, setClienteNome] = useState(p.cliente ? `${p.cliente.nome}${p.cliente.apelido ? ` (${p.cliente.apelido})` : ''}` : '')
  const [termo, setTermo] = useState('')
  const [sugestoes, setSugestoes] = useState<ClienteResumo[]>([])
  const [prometida, setPrometida] = useState(p.prometidaPara?.slice(0, 10) ?? '')
  const [responsavelId, setResponsavelId] = useState(p.responsavelId)
  const [observacoes, setObservacoes] = useState(p.observacoes ?? '')

  useEffect(() => {
    if (termo.trim().length < 2) { setSugestoes([]); return }
    const t = setTimeout(() => { buscarClientesAction(termo).then(setSugestoes) }, 150)
    return () => clearTimeout(t)
  }, [termo])

  function escolher(c: ClienteResumo | null) {
    setClienteId(c?.id ?? null)
    setClienteNome(c ? `${c.nome}${c.apelido ? ` (${c.apelido})` : ''}` : '')
    setTermo(''); setSugestoes([])
  }

  function salvar() {
    if (pendente) return
    iniciar(async () => {
      const r = await atualizarCabecalhoAction(p.ordemId, p.versao, chave.current, p.somenteObservacoes
        ? { observacoes }
        : { clienteId, prometidaPara: prometida || null, responsavelId, observacoes })
      setResposta(r)
      if (r.ok) { chave.current = gerarChave(); iniciar(() => router.refresh()) }
      else if (r.conflito) router.refresh()
      else chave.current = gerarChave()
    })
  }

  function atalho(e: KeyboardEvent<HTMLFormElement>) {
    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); salvar() }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvar() }} onKeyDown={atalho} className="row g-3">
      {!p.somenteObservacoes ? (
        <>
          <div className="col-md-6 position-relative">
            <label className="form-label" htmlFor="cliente">Cliente</label>
            <input id="cliente" className="form-control" autoComplete="off" placeholder="Nome, apelido ou telefone — vazio é venda de balcão"
              value={termo || clienteNome}
              onChange={(e) => { setTermo(e.target.value); if (e.target.value === '') escolher(null) }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setTermo(''); setSugestoes([]) } }} />
            {sugestoes.length > 0 ? (
              <ul className="list-group position-absolute w-100 shadow" role="listbox" style={{ zIndex: 10 }}>
                {sugestoes.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="list-group-item list-group-item-action" onClick={() => escolher(c)}>
                      {c.nome}<SeloApelido apelido={c.apelido} />
                      <span className="text-secondary ms-2">{c.telefones[0]?.normalizado ? formatarTelefone(c.telefones[0].normalizado) : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {clienteId === null && clienteNome === '' ? <div className="form-hint">Venda de balcão</div> : null}
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="prometida">Entrega prometida</label>
            <input id="prometida" type="date" className="form-control" value={prometida} onChange={(e) => setPrometida(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="responsavel">Responsável</label>
            <select id="responsavel" className="form-select" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              {p.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </>
      ) : null}
      <div className="col-12">
        <label className="form-label" htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" className="form-control" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <div className="col-12 d-flex align-items-center gap-2">
        <button type="submit" className="btn" disabled={pendente}>{pendente ? SALVANDO : 'Salvar cabeçalho'}</button>
        <span className="small text-secondary">Ctrl+S</span>
        {resposta?.ok ? <span className="text-success small">Salvo.</span> : null}
        {resposta && !resposta.ok && !resposta.conflito ? <span className="text-danger small" role="alert">{resposta.erro}</span> : null}
      </div>
    </form>
  )
}
