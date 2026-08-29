import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'
import type { Fila, OrdemDaFila } from '@/domain/caixa/fila'

function Cliente({ o }: { o: OrdemDaFila }) {
  return <>{o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}{o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}</>
}

/** A tela 1 da spec, movida da rota para ca quando `/` passou a decidir por papel. */
export function FilaDeTrabalho({ fila }: { fila: Fila }) {
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Fila de trabalho</h2>
            </div>
            <div className="col-auto"><Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link></div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" action="/ordens" className="mb-3" role="search">
            <div className="input-icon">
              <span className="input-icon-addon"><IconSearch className="icon" /></span>
              <input type="search" name="q" className="form-control form-control-lg" placeholder="Número da OS, cliente ou apelido" aria-label="Buscar ordem" autoFocus />
            </div>
          </form>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header"><h3 className="card-title">Abertas há mais de uma semana</h3><span className="badge bg-secondary-lt ms-auto">{fila.paradas.length}</span></div>
                {fila.paradas.length === 0 ? (
                  <div className="card-body text-secondary">Nenhuma ordem parada. É assim que deve ficar.</div>
                ) : (
                  <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens paradas">
                    <thead><tr><th>Nº</th><th>Cliente</th><th>Aberta em</th><th>Entrega</th></tr></thead>
                    <tbody>{fila.paradas.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{formatarNumeroOs(o.numero)}</Link></td>
                        <td><Cliente o={o} /></td>
                        <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                        <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header"><h3 className="card-title">Concluídas e não pagas</h3><span className="ms-auto fw-bold numero" data-testid="total-a-cobrar">{formatarMoeda(dinheiro(fila.totalACobrar))}</span></div>
                {fila.aCobrar.length === 0 ? (
                  <div className="card-body text-secondary">Nada a cobrar. Todo serviço finalizado já foi recebido.</div>
                ) : (
                  <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens a cobrar">
                    <thead><tr><th>Nº</th><th>Cliente</th><th>Finalizada em</th><th className="text-end">Falta</th></tr></thead>
                    <tbody>{fila.aCobrar.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{formatarNumeroOs(o.numero)}</Link></td>
                        <td><Cliente o={o} /></td>
                        <td className="text-secondary">{o.concluidaEm ? formatarDataHora(new Date(o.concluidaEm)) : '—'}</td>
                        <td className="numero">{formatarMoeda(dinheiro(o.saldo))}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
