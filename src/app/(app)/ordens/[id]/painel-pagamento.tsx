'use client'
import { CONFLITO_ORDEM_RECARREGANDO, SALVANDO } from '@/componentes/rotulos'
import { SituacaoPagamento } from '@/componentes/situacao'
import { valorEmReais } from '@/componentes/dinheiro'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FORMAS_PAGAMENTO, ROTULO_FORMA } from '@/domain/caixa/formas'
import type { EstadoPagamento, EstadoProducao } from '@/domain/ordem/estados'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { RecebimentoTela } from '@/infra/ordens/repositorio'
import { registrarRecebimentoAction, concluirOrdemAction, estornarRecebimentoAction, type RespostaDinheiro } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  versao: number
  estadoProducao: EstadoProducao
  pagamento: { estado: EstadoPagamento; totalRecebido: string; saldo: string }
  recebimentos: RecebimentoTela[]
  /** 'AAAA-MM-DD' de hoje em Sao Paulo, calculado no servidor. */
  hoje: string
  podeConcluir: boolean
  podeReceber: boolean
  administracao: boolean
}

export function PainelPagamento(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<RespostaDinheiro | null>(null)
  const chave = useRef(gerarChave())
  /*
   * OS CAMPOS DO RECEBIMENTO NAO SAO ESTADO DO REACT, e aqui a razao e dinheiro.
   *
   * Eram `useState` semeado pela prop -- e o valor nascia preenchido com o SALDO
   * INTEIRO. Entre o HTML do servidor aparecer e o React assumir existe uma
   * janela: quem apagasse os 1.800,00 e digitasse 300,00 ali escrevia no DOM e
   * nao no estado, e a hidratacao devolvia o campo ao saldo cheio. O clique
   * seguinte registrava 1.800,00 recebidos, lancava 1.800,00 no caixa e marcava a
   * ordem como paga. O cliente devendo 1.500 e o sistema dizendo que nao deve
   * nada -- e a ordem sumindo da fila de cobranca, que e exatamente o buraco por
   * onde o sistema antigo deixou R$ 207 mil parados.
   *
   * A data sofria do mesmo e tambem em silencio: voltava para hoje, e recebimento
   * com data errada bagunca o fechamento do mes. A forma voltava para vazio, o
   * que ao menos dava erro visivel.
   *
   * Nao controlados, quem manda no campo e o proprio campo. O que estiver escrito
   * nele na hora de gravar e o que vai.
   */
  const refValor = useRef<HTMLInputElement>(null)
  const refForma = useRef<HTMLSelectElement>(null)
  const refData = useRef<HTMLInputElement>(null)
  const refObservacao = useRef<HTMLInputElement>(null)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  function tratar(r: RespostaDinheiro) {
    setResposta(r)
    if (r.ok) {
      chave.current = gerarChave()
      // Depois de um recebimento parcial o campo passa a mostrar o que AINDA
      // falta -- e a proxima pergunta que a Odete faz. Com campo nao controlado
      // isso vira escrita explicita, e nao efeito colateral de um `setState`.
      if (refValor.current) refValor.current.value = r.resultado.saldo.replace('.', ',')
      if (refForma.current) refForma.current.value = ''
      if (refObservacao.current) refObservacao.current.value = ''
      setEstornando(null); setMotivo('')
      iniciar(() => router.refresh())
    } else if (r.conflito) {
      router.refresh()
    } else {
      chave.current = gerarChave()
    }
  }

  function receber(e: FormEvent<HTMLFormElement>, concluir: boolean) {
    e.preventDefault()
    if (pendente) return
    // Lido do campo, e nao do estado: e o que garante que o digitado antes da
    // hidratacao seja o que vai para o caixa.
    const valor = refValor.current?.value ?? ''
    const forma = refForma.current?.value ?? ''
    const data = refData.current?.value ?? p.hoje
    const observacao = refObservacao.current?.value ?? ''
    iniciar(async () => tratar(await registrarRecebimentoAction(p.ordemId, p.versao, chave.current, { valor, forma, data, observacao, concluir })))
  }

  function concluir() {
    if (pendente) return
    iniciar(async () => tratar(await concluirOrdemAction(p.ordemId, p.versao, chave.current)))
  }

  function estornar(e: FormEvent<HTMLFormElement>, recebimentoId: string) {
    e.preventDefault()
    if (pendente) return
    iniciar(async () => tratar(await estornarRecebimentoAction(p.ordemId, p.versao, chave.current, recebimentoId, motivo)))
  }

  const erro = resposta && !resposta.ok && !resposta.conflito ? resposta.erro : null
  const conflito = resposta !== null && !resposta.ok && resposta.conflito === true
  const aberta = p.estadoProducao === 'aberta'

  return (
    <div className="card" aria-busy={pendente}>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          {/* h2, nao h3: a ficha da ordem tem o h1 do cabecalho e mais nada entre os
            dois, entao o h3 abria um buraco no indice de titulos do leitor de
            tela (1 -> 3). E o mesmo nivel que o CartaoTabela usa no resto do
            sistema; o `.card-title` mantem o tamanho. */}
        <h2 className="card-title mb-0">Pagamento</h2>
          <SituacaoPagamento estado={p.pagamento.estado} semValor={Number(p.pagamento.totalRecebido) === 0 && Number(p.pagamento.saldo) === 0} testId="estado-pagamento" />
        </div>
        <dl className="row mb-0 mt-2">
          <dt className="col-7">Recebido</dt><dd className="col-5 numero">{valorEmReais(p.pagamento.totalRecebido)}</dd>
          <dt className="col-7">Saldo a receber</dt><dd className="col-5 numero fw-bold" data-testid="saldo">{valorEmReais(p.pagamento.saldo)}</dd>
        </dl>
        {conflito ? <div className="alert alert-warning mt-2 mb-0" role="alert">{CONFLITO_ORDEM_RECARREGANDO}</div> : null}
      </div>

      {p.podeReceber && p.administracao && p.pagamento.estado !== 'pago' ? (
        <form className="card-body border-top d-flex flex-column gap-2" onSubmit={(e) => receber(e, aberta)}>
          <label className="form-label mb-0" htmlFor="valorRecebido">Valor recebido</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            <input id="valorRecebido" ref={refValor} className="form-control numero" inputMode="decimal" defaultValue={p.pagamento.saldo.replace('.', ',')} />
          </div>
          <label className="form-label mb-0" htmlFor="formaPagamento">Forma de pagamento</label>
          <select id="formaPagamento" ref={refForma} className="form-select" defaultValue="">
            <option value="">Escolha a forma</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{ROTULO_FORMA[f]}</option>)}
          </select>
          <label className="form-label mb-0" htmlFor="dataRecebimento">Data</label>
          <input id="dataRecebimento" ref={refData} type="date" className="form-control" defaultValue={p.hoje} />
          <label className="form-label mb-0" htmlFor="observacaoRecebimento">Observação</label>
          <input id="observacaoRecebimento" ref={refObservacao} className="form-control" defaultValue="" placeholder="opcional" />
          <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? SALVANDO : aberta ? 'Concluir e receber' : 'Receber'}</button>
          {aberta ? (
            <button type="button" className="btn btn-link px-0" disabled={pendente}
              onClick={(e) => receber(e as unknown as FormEvent<HTMLFormElement>, false)}>
              Só receber — a ordem continua aberta
            </button>
          ) : null}
          {erro ? <div className="text-danger-emphasis small" role="alert">{erro}</div> : null}
        </form>
      ) : null}

      {p.podeConcluir ? (
        <div className="card-body border-top">
          <button type="button" className="btn" disabled={pendente} onClick={concluir}>Serviço finalizado</button>
          <div className="form-hint">Marca a produção como pronta. Não mexe em dinheiro.</div>
          {!p.administracao && erro ? <div className="text-danger-emphasis small" role="alert">{erro}</div> : null}
        </div>
      ) : null}

      {p.recebimentos.length > 0 ? (
        <div className="table-responsive border-top">
          {/* Mesmo motivo da tabela de itens: o "Estornar" fica na ponta direita,
              e estornar o recebimento errado mexe no caixa do dia. */}
          <table className="table table-sm card-table table-hover" aria-label="Recebimentos">
            <thead><tr><th>Data</th><th>Forma</th><th className="text-end">Valor</th><th className="w-1"></th></tr></thead>
            <tbody>
              {p.recebimentos.map((r) => (
                <tr key={r.id} className={r.estornadoEm ? 'text-secondary' : ''}>
                  <td>{formatarDataCalendario(new Date(r.data))}{r.observacao ? <div className="small">{r.observacao}</div> : null}{r.estornadoEm ? <div className="small">estornado · {r.motivoEstorno}</div> : null}</td>
                  <td>{ROTULO_FORMA[r.forma]}<div className="small">{r.usuario}</div></td>
                  <td className={`numero ${r.estornadoEm ? 'text-decoration-line-through' : ''}`}>{valorEmReais(r.valor)}</td>
                  <td>
                    {p.administracao && !r.estornadoEm && estornando !== r.id ? (
                      <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => { setEstornando(r.id); setMotivo('') }}>Estornar</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {estornando ? (
            <form className="card-body d-flex flex-column gap-2" onSubmit={(e) => estornar(e, estornando)}>
              <label className="form-label mb-0" htmlFor="motivoEstorno">Motivo do estorno</label>
              <input id="motivoEstorno" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-danger" disabled={pendente}>Confirmar estorno</button>
                <button type="button" className="btn btn-link" onClick={() => setEstornando(null)}>Voltar</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
