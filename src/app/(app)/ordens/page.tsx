import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { listarOrdens } from '@/infra/ordens/repositorio'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { ROTULO_ESTADO } from '@/domain/ordem/estados'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Ordens' }

const COR_ESTADO = { orcamento: 'bg-secondary-lt', aberta: 'bg-primary-lt', concluida: 'bg-success-lt', cancelada: 'bg-danger-lt' } as const

export default async function PaginaOrdens() {
  const usuario = await exigirUsuario()
  const ordens = await listarOrdens(usuario.empresaId)

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
          {ordens.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Nenhuma ordem ainda</p>
              <p className="empty-subtitle text-secondary">A primeira será a nº 18461, continuando a numeração do sistema antigo.</p>
              <div className="empty-action"><Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link></div>
            </div></div></div>
          ) : (
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead><tr><th>Nº</th><th>Cliente</th><th>Situação</th><th>Aberta em</th><th>Entrega</th><th className="text-end">Preço final</th></tr></thead>
                <tbody>
                  {ordens.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{String(o.numero).padStart(6, '0')}</Link></td>
                      <td>
                        {o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}
                        {o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}
                      </td>
                      <td><span className={`badge ${COR_ESTADO[o.estadoProducao]}`}>{ROTULO_ESTADO[o.estadoProducao]}</span></td>
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
