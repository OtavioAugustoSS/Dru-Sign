import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarLivro } from '@/infra/caixa/livro'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDataCalendario, mesCalendario } from '@/domain/ordem/datas'
import { formatarNumeroOs, ROTULO_TIPO_LANCAMENTO } from '@/domain/caixa/lancamento'
import { BotaoEstorno } from './botao-estorno'

export const metadata: Metadata = { title: 'Financeiro' }

export default async function PaginaFinanceiro({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const mes = mesCalendario(new Date())
  const { de = mes.de, ate = mes.ate } = await searchParams
  let livro
  let erro: string | null = null
  try {
    livro = await listarLivro(usuario.empresaId, { de, ate })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    livro = await listarLivro(usuario.empresaId, mes)
  }
  const R$ = (v: string) => formatarMoeda(dinheiro(v))

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col"><div className="page-pretitle">Administração</div><h2 className="page-title">Livro-caixa</h2></div>
            <div className="col-auto"><Link href="/financeiro/saida" className="btn btn-primary"><IconPlus className="icon" /> Nova saída</Link></div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" className="card mb-3">
            <div className="card-body row g-2 align-items-end">
              <div className="col-md-3"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={livro.de} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={livro.ate} /></div>
              <div className="col-md-2"><button type="submit" className="btn btn-primary">Mostrar</button></div>
              {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando o mês atual.</div> : null}
            </div>
          </form>

          <div className="row g-3 mb-3">
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Entradas</div><div className="h2 mb-0 numero" data-testid="entradas">{R$(livro.entradas)}</div></div></div></div>
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Saídas</div><div className="h2 mb-0 numero" data-testid="saidas">{R$(livro.saidas)}</div></div></div></div>
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Saldo do período</div><div className="h2 mb-0 numero" data-testid="saldo-periodo">{R$(livro.saldo)}</div></div></div></div>
          </div>

          {livro.linhas.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Nenhum lançamento no período</p>
              <p className="empty-subtitle text-secondary">Entradas nascem dos recebimentos, na ordem. Saídas você lança aqui.</p>
              <div className="empty-action"><Link href="/financeiro/saida" className="btn btn-primary">Nova saída</Link></div>
            </div></div></div>
          ) : (
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table" aria-label="Lançamentos">
                <thead><tr><th>Data</th><th>Tipo</th><th>Histórico</th><th>Conta</th><th>Quem</th><th className="text-end">Valor</th><th className="w-1"></th></tr></thead>
                <tbody>
                  {livro.linhas.map((l) => (
                    <tr key={l.id} className={l.estornadoEm ? 'text-secondary' : ''}>
                      <td>{formatarDataCalendario(new Date(l.data))}</td>
                      <td><span className={`badge ${l.tipo === 'entrada' ? 'bg-success-lt' : 'bg-danger-lt'}`}>{ROTULO_TIPO_LANCAMENTO[l.tipo]}</span></td>
                      <td>
                        {l.ordemId ? <Link href={`/ordens/${l.ordemId}`} className="text-reset">{l.historico}</Link> : l.historico}
                        {l.fornecedor ? <div className="small text-secondary">{l.fornecedor}</div> : null}
                        {l.parcela ? <div className="small text-secondary">parcela {l.parcela}/{l.totalParcelas}</div> : null}
                        {l.estornadoEm ? <div className="small">estornado · {l.motivoEstorno}</div> : null}
                      </td>
                      <td className="text-secondary">{l.contaCodigo} · {l.contaNome}</td>
                      <td className="text-secondary">{l.usuarioNome}</td>
                      <td className={`numero ${l.estornadoEm ? 'text-decoration-line-through' : ''}`}>{l.tipo === 'saida' ? '−' : ''}{R$(l.valor)}</td>
                      <td>{l.tipo === 'saida' && !l.estornadoEm ? <BotaoEstorno lancamentoId={l.id} /> : l.ordemNumero ? <span className="small text-secondary">OS {formatarNumeroOs(l.ordemNumero)}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </div>
      </div>
    </>
  )
}
