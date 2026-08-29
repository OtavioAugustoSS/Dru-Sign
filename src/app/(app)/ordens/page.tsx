import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { listarOrdens } from '@/infra/ordens/repositorio'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { ROTULO_ESTADO } from '@/domain/ordem/estados'
import { ROTULO_PAGAMENTO } from '@/domain/caixa/pagamento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Ordens' }

const COR_ESTADO = { orcamento: 'bg-secondary-lt', aberta: 'bg-primary-lt', concluida: 'bg-success-lt', cancelada: 'bg-danger-lt' } as const
const COR_PAGAMENTO = { nao_pago: 'bg-danger-lt', parcial: 'bg-warning-lt', pago: 'bg-success-lt' } as const

export default async function PaginaOrdens({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string }> }) {
  const usuario = await exigirUsuario()
  const { q = '', estado = '', de = '', ate = '' } = await searchParams
  const estadoValido = (['orcamento', 'aberta', 'concluida', 'cancelada'] as const).find((e) => e === estado)
  const ordens = await listarOrdens(usuario.empresaId, { q, estado: estadoValido, de: de || undefined, ate: ate || undefined })

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Ordens</h2>
            </div>
            <div className="col-auto">
              <Link href="/ordens/nova" className="btn btn-primary"><IconPlus className="icon" /> Nova ordem</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" className="card mb-3" role="search">
            <div className="card-body row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label" htmlFor="q">Buscar</label>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou apelido" />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="estado">Situação</label>
                <select id="estado" name="estado" className="form-select" defaultValue={estado}>
                  <option value="">Todas</option>
                  {(['orcamento', 'aberta', 'concluida', 'cancelada'] as const).map((e) => <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>)}
                </select>
              </div>
              <div className="col-md-2"><label className="form-label" htmlFor="de">Aberta de</label><input id="de" type="date" name="de" className="form-control" defaultValue={de} /></div>
              <div className="col-md-2"><label className="form-label" htmlFor="ate">até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} /></div>
              <div className="col-md-2 d-flex gap-2"><button type="submit" className="btn btn-primary">Filtrar</button><Link href="/ordens" className="btn">Limpar</Link></div>
            </div>
          </form>
          {ordens.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">{q || estado || de ? 'Nenhuma ordem com esse filtro' : 'Nenhuma ordem ainda'}</p>
              <p className="empty-subtitle text-secondary">A primeira será a nº 18461, continuando a numeração do sistema antigo.</p>
              <div className="empty-action"><Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link></div>
            </div></div></div>
          ) : (
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead><tr><th>Nº</th><th>Cliente</th><th>Situação</th><th>Pagamento</th><th>Aberta em</th><th>Entrega</th><th className="text-end">Preço final</th></tr></thead>
                <tbody>
                  {ordens.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{String(o.numero).padStart(6, '0')}</Link></td>
                      <td>
                        {o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}
                        {o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}
                      </td>
                      <td><span className={`badge ${COR_ESTADO[o.estadoProducao]}`}>{ROTULO_ESTADO[o.estadoProducao]}</span></td>
                      <td><span className={`badge ${COR_PAGAMENTO[o.estadoPagamento]}`}>{ROTULO_PAGAMENTO[o.estadoPagamento]}</span>{o.estadoPagamento === 'parcial' ? <span className="small text-secondary ms-2">falta {formatarMoeda(dinheiro(o.saldo))}</span> : null}</td>
                      <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                      <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
                      <td className="numero">{formatarMoeda(dinheiro(o.precoFinal))}</td>
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
