'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { resolverLinha, descreverLinha, proximaUnidade, type MaterialCatalogo } from '@/domain/precificacao/resolucao'
import type { UnidadeCobranca } from '@/domain/precificacao/tipos'
import { adicionarItemAction, adicionarAcrescimoAction, type Resposta } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  /** Do Server Component: chega incrementada a cada action, na mesma resposta. */
  versao: number
  catalogo: MaterialCatalogo[]
}

const ROTULO_PENDENCIA = {
  valor: 'Falta o valor unitário.',
  quantidade: 'Quantidade precisa ser maior que zero.',
  dimensao: 'Informe altura x largura para cobrar por m² ou metro linear — ou cobre por unidade.',
  tipo_acrescimo: 'Tipo do acréscimo: instalacao, deslocamento, frete ou imposto.',
} as const

const ROTULO_ORIGEM = { material: 'unidade do material', padrao: 'sem material no catálogo: por unidade', sufixo: 'unidade pelo sufixo', escolhida: 'unidade escolhida' } as const

export function EntradaLinha({ ordemId, versao, catalogo }: Props) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<UnidadeCobranca | undefined>()
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [mostrarPendencia, setMostrarPendencia] = useState(false)
  const [pendente, iniciar] = useTransition()
  const campo = useRef<HTMLInputElement>(null)
  const chave = useRef(gerarChave())
  /** Texto gravado com sucesso: o campo so limpa quando a transition (action + refresh) termina. */
  const enviado = useRef<string | null>(null)

  // `preventScroll`: o campo fica abaixo da dobra, e focar sem isto joga a pagina
  // para baixo sozinha no carregamento -- medido em 783px, e de forma
  // intermitente, que e pior. O foco ainda vai para ca; a tela e que fica quieta.
  useEffect(() => {
    campo.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (pendente || enviado.current === null) return
    const texto = enviado.current
    enviado.current = null
    // Se a pessoa ja comecou a digitar a proxima linha durante o "Gravando…", nao apaga o que ela escreveu.
    setTexto((atual) => (atual === texto ? '' : atual))
    setUnidadeEscolhida(undefined); setMostrarPendencia(false)
    campo.current?.focus({ preventScroll: true })
  }, [pendente])

  const resolvido = useMemo(
    () => (texto.trim() === '' ? null : resolverLinha(texto, catalogo, { unidadeEscolhida })),
    [texto, catalogo, unidadeEscolhida],
  )
  const preview = resolvido ? descreverLinha(resolvido) : null

  function limpar() {
    setTexto(''); setUnidadeEscolhida(undefined); setResposta(null); setMostrarPendencia(false)
    campo.current?.focus()
  }

  function confirmar() {
    if (!resolvido || pendente) return
    if (resolvido.pendencias.length > 0) { setMostrarPendencia(true); return }
    const base = [ordemId, versao, chave.current] as const
    const textoEnviado = texto
    iniciar(async () => {
      const r = resolvido.tipo === 'acrescimo'
        ? await adicionarAcrescimoAction(...base, { tipo: resolvido.tipoAcrescimo!, descricao: resolvido.descricao, valor: resolvido.valor!.toFixed(2) })
        : await adicionarItemAction(...base, {
            descricao: resolvido.material ? `${resolvido.material.nome}${resolvido.descricao ? ` — ${resolvido.descricao}` : ''}` : resolvido.descricao,
            materialId: resolvido.material?.id ?? null,
            quantidade: resolvido.quantidade,
            altura: resolvido.altura?.toFixed(4) ?? null,
            largura: resolvido.largura?.toFixed(4) ?? null,
            unidadeCobranca: resolvido.unidade,
            valorUnitario: resolvido.valorUnitario!.toFixed(2),
          })
      setResposta(r)
      // A chave so muda depois que o servidor respondeu; no conflito ela fica (a intencao e a mesma).
      // O refresh entra na mesma transition: `pendente` so cai quando a versao nova ja esta nos props,
      // e um Enter dado no meio do caminho e ignorado em vez de partir com versao velha.
      if (r.ok) { chave.current = gerarChave(); enviado.current = textoEnviado; iniciar(() => router.refresh()) }
      else if (!r.conflito) { chave.current = gerarChave(); campo.current?.focus() }
    })
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmar() }
    else if (e.key === 'Escape') { e.preventDefault(); limpar() }
    else if (e.altKey && e.key.toLowerCase() === 'u' && resolvido?.tipo === 'item') { e.preventDefault(); setUnidadeEscolhida(proximaUnidade(resolvido.unidade)) }
  }

  const conflito = resposta !== null && !resposta.ok && resposta.conflito === true
  const erro = resposta !== null && !resposta.ok && !resposta.conflito ? resposta.erro : null

  return (
    <div className="card-body" aria-busy={pendente}>
      {conflito ? (
        <div className="alert alert-warning d-flex align-items-center" role="alert">
          <div className="flex-fill">Esta ordem mudou enquanto você editava. O que você digitou está preservado.</div>
          <button type="button" className="btn btn-warning" onClick={() => { setResposta(null); router.refresh() }}>Recarregar e continuar</button>
        </div>
      ) : null}
      <label className="form-label" htmlFor="linha">Lançar item ou acréscimo</label>
      <input
        ref={campo} id="linha" className="form-control form-control-lg" autoComplete="off"
        placeholder="12 placas ACM 61x40 61,00 — ou +instalacao 280"
        value={texto} onKeyDown={aoTeclar}
        onChange={(e) => { setTexto(e.target.value); setUnidadeEscolhida(undefined); setMostrarPendencia(false); if (erro) setResposta(null) }}
      />
      <div className="mt-2" aria-live="polite" id="preview">
        {resolvido && preview ? (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-secondary">Entendi: {preview.texto}</span>
            {preview.total ? <strong>→ {preview.total}</strong> : null}
            {preview.conferencia === 'diverge' ? <span className="badge bg-warning-lt">o total digitado não bate com qtd × unitário</span> : null}
            {resolvido.tipo === 'item' ? (
              <select className="form-select form-select-sm w-auto" aria-label="Cobrar por" value={resolvido.unidade}
                title={ROTULO_ORIGEM[resolvido.origemUnidade]}
                onChange={(e) => setUnidadeEscolhida(e.target.value as UnidadeCobranca)}>
                <option value="unidade">por unidade</option>
                <option value="m2">por m² (área)</option>
                <option value="metro_linear">por metro linear (perímetro)</option>
              </select>
            ) : null}
            <span className="small text-secondary">{pendente ? SALVANDO : 'Enter adiciona · Esc limpa · Alt+U troca a unidade'}</span>
          </div>
        ) : (
          <span className="small text-secondary">Digite como no papel: quantidade, o que é, medida e valor. Acréscimo começa com +.</span>
        )}
        {mostrarPendencia && resolvido && resolvido.pendencias[0] ? <div className="text-danger-emphasis mt-1" role="alert">{ROTULO_PENDENCIA[resolvido.pendencias[0]]}</div> : null}
        {erro ? <div className="text-danger-emphasis mt-1" role="alert">{erro} Enter para tentar de novo.</div> : null}
      </div>
    </div>
  )
}
