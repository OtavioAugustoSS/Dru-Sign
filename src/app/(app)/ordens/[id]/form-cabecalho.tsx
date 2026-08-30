'use client'
import { SALVANDO } from '@/componentes/rotulos'
import { Apelido } from '@/componentes/situacao'

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ClienteResumo } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { atualizarCabecalhoAction, buscarClientesAction, criarClienteRapidoAction, type Resposta } from './actions'
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
  /* Cadastro de cliente sem sair da ordem: `null` enquanto ninguem pediu. */
  const [cadastrando, setCadastrando] = useState<{ nome: string; telefone: string } | null>(null)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)

  useEffect(() => {
    if (termo.trim().length < 2) { setSugestoes([]); return }
    const t = setTimeout(() => { buscarClientesAction(termo).then(setSugestoes) }, 150)
    return () => clearTimeout(t)
  }, [termo])

  /**
   * Escolher o cliente JA GRAVA a ordem.
   *
   * Todo o resto desta tela se grava sozinho: o item entra no Enter, o
   * recebimento no botao. So o cabecalho esperava o "Salvar" -- e quem escolhia
   * o cliente na busca via o nome aparecer no campo e seguia para os itens. A
   * ordem continuava "Venda de balcao", e saia impressa assim. Erro caro numa
   * grafica: a OS vai para a bancada sem dizer de quem e.
   *
   * O id vai por parametro porque `setClienteId` so vale no proximo render: ler
   * do estado aqui gravaria o cliente ANTERIOR.
   */
  function escolher(c: ClienteResumo | null) {
    setClienteId(c?.id ?? null)
    setClienteNome(c ? `${c.nome}${c.apelido ? ` (${c.apelido})` : ''}` : '')
    setTermo(''); setSugestoes([]); setCadastrando(null); setErroCadastro(null)
    if (!p.somenteObservacoes) salvar({ clienteId: c?.id ?? null })
  }

  function cadastrarEUsar() {
    if (cadastrando === null || pendente) return
    setErroCadastro(null)
    iniciar(async () => {
      const r = await criarClienteRapidoAction(cadastrando.nome, cadastrando.telefone)
      if (!r.ok) { setErroCadastro(r.erro); return }
      escolher(r.cliente)
    })
  }

  function salvar(sobrescreve?: { clienteId: string | null }) {
    // A gravacao vinda de `escolher` passa pelo guarda: ela nasce DENTRO da
    // transicao do cadastro rapido, entao `pendente` ja e true ali.
    if (pendente && sobrescreve === undefined) return
    iniciar(async () => {
      const r = await atualizarCabecalhoAction(p.ordemId, p.versao, chave.current, p.somenteObservacoes
        ? { observacoes }
        : { clienteId: sobrescreve ? sobrescreve.clienteId : clienteId, prometidaPara: prometida || null, responsavelId, observacoes })
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
            <input id="cliente" className="form-control" autoComplete="off" placeholder="Nome, apelido ou telefone"
              role="combobox" aria-expanded={sugestoes.length > 0} aria-controls="sugestoes-cliente" aria-autocomplete="list"
              value={termo || clienteNome}
              onChange={(e) => { setTermo(e.target.value); if (e.target.value === '') escolher(null) }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setTermo(''); setSugestoes([]) } }} />
            {sugestoes.length > 0 ? (
              <ul className="list-group position-absolute w-100 shadow lista-sugestoes" id="sugestoes-cliente" role="listbox" aria-label="Clientes encontrados">
                {sugestoes.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="list-group-item list-group-item-action" onClick={() => escolher(c)}>
                      {c.nome}<Apelido apelido={c.apelido} />
                      <span className="text-secondary ms-2">{c.telefones[0]?.normalizado ? formatarTelefone(c.telefones[0].normalizado) : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* O cadastro rapido so aparece depois de a busca nao achar: enquanto
                ha sugestoes, o caminho certo e escolher uma delas -- oferecer
                "cadastrar" ao lado de um cliente que ja existe e convite para
                duplicar ficha, que e justamente o que o sistema antigo fazia
                (2.734 cadastros para 1.847 documentos). */}
            {termo.trim().length >= 2 && sugestoes.length === 0 && cadastrando === null ? (
              <div className="form-hint">
                Ninguém com esse nome.{' '}
                <button
                  type="button"
                  className="btn btn-link p-0 align-baseline"
                  onClick={() => { setCadastrando({ nome: termo.trim(), telefone: '' }); setErroCadastro(null) }}
                >
                  Cadastrar “{termo.trim()}”
                </button>
              </div>
            ) : null}

            {cadastrando !== null ? (
              <div className="card mt-2">
                <div className="card-body row g-2 align-items-end">
                  <div className="col-12">
                    <span className="form-label mb-0">Cliente novo</span>
                    <div className="form-hint mt-0">O resto da ficha se completa depois, sem segurar a ordem.</div>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="cadastroNome">Nome</label>
                    <input id="cadastroNome" className="form-control" value={cadastrando.nome}
                      onChange={(e) => setCadastrando({ ...cadastrando, nome: e.target.value })} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="cadastroTelefone">Telefone</label>
                    <input id="cadastroTelefone" className="form-control" inputMode="tel" placeholder="opcional"
                      value={cadastrando.telefone}
                      onChange={(e) => setCadastrando({ ...cadastrando, telefone: e.target.value })} />
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button type="button" className="btn btn-primary" onClick={cadastrarEUsar} disabled={pendente}>
                      {pendente ? SALVANDO : 'Cadastrar e usar'}
                    </button>
                    <button type="button" className="btn" onClick={() => { setCadastrando(null); setErroCadastro(null) }}>
                      Cancelar
                    </button>
                    {erroCadastro ? <span className="text-danger-emphasis small align-self-center" role="alert">{erroCadastro}</span> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {clienteId === null && clienteNome === '' && cadastrando === null ? <div className="form-hint">Sem cliente: entra como venda de balcão.</div> : null}
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
        {resposta && !resposta.ok && !resposta.conflito ? <span className="text-danger-emphasis small" role="alert">{resposta.erro}</span> : null}
      </div>
    </form>
  )
}
