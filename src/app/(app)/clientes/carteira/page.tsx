import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { valorEmReais } from '@/componentes/dinheiro'
import { Percentual } from '@/componentes/percentual'
import { SeloApelido, SeloRecencia } from '@/componentes/selo'
import { carregarCarteira } from '@/infra/clientes/carteira'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { GrupoCarteira } from '@/domain/clientes/carteira'

export const metadata: Metadata = { title: 'Carteira de clientes' }


function Nome({ g }: { g: GrupoCarteira }) {
  return (
    <>
      {g.clienteIds.length === 1 && g.clienteIds[0]
        ? <Link href={`/clientes/${g.clienteIds[0]}`} className="text-reset fw-medium">{g.nome}</Link>
        : <span className="fw-medium">{g.nome}</span>}
      <SeloApelido apelido={g.apelido} />
      {g.cadastros > 1 ? <div className="small text-secondary">{g.cadastros} cadastros com o mesmo documento</div> : null}
      {g.documento ? <div className="small text-secondary">{formatarDocumento(g.documento)}</div> : null}
    </>
  )
}

export default async function PaginaCarteira() {
  const usuario = await exigirPapel('administracao')
  const carteira = await carregarCarteira(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col"><div className="page-pretitle">Administração</div><h1 className="page-title">Carteira de clientes</h1></div>
          <div className="col-auto"><Link href="/clientes" className="btn">Todos os cadastros</Link></div>
        </div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        {carteira.grupos.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty">
            <p className="empty-title">Nenhum cliente comprou ainda</p>
            <p className="empty-subtitle text-secondary">A carteira nasce das ordens. Venda de balcão não entra: ela não tem nome.</p>
          </div></div></div>
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Faturado</div><div className="h2 mb-0 numero" data-testid="faturado-total">{valorEmReais(carteira.faturadoTotal)}</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Ativos</div><div className="h2 mb-0 numero">{carteira.contagem.ativo}</div><div className="text-secondary small">compraram nos últimos 6 meses</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Adormecidos</div><div className="h2 mb-0 numero" data-testid="adormecidos">{carteira.contagem.adormecido}</div><div className="text-secondary small">de 6 a 24 meses — é a lista de reativação</div></div></div></div>
              <div className="col-md-3"><div className="card card-sm"><div className="card-body"><div className="subheader">Perdidos</div><div className="h2 mb-0 numero">{carteira.contagem.perdido}</div><div className="text-secondary small">mais de 2 anos sem comprar</div></div></div></div>
            </div>

            {carteira.paraReativar.length > 0 ? (
              <div className="card mb-3">
                <div className="card-header"><h2 className="card-title">Para reativar</h2><span className="ms-auto text-secondary">{carteira.paraReativar.length} nomes, do maior faturamento para o menor</span></div>
                <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Para reativar">
                  <thead><tr><th>Cliente</th><th>Última ordem</th><th className="text-end">Já faturou</th></tr></thead>
                  <tbody>
                    {carteira.paraReativar.map((g) => (
                      <tr key={g.documento ?? g.clienteIds[0]}>
                        <td><Nome g={g} /></td>
                        <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                        <td className="numero">{valorEmReais(g.faturado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            ) : null}

            <div className="card">
              <div className="card-header"><h2 className="card-title">Concentração de receita</h2></div>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Concentração de receita">
                <thead><tr><th>Cliente</th><th>Situação</th><th className="text-end">Ordens</th><th className="text-end">Faturado</th><th className="text-end">Fatia</th></tr></thead>
                <tbody>
                  {carteira.grupos.map((g) => (
                    <tr key={g.documento ?? g.clienteIds[0]}>
                      <td><Nome g={g} /></td>
                      <td><SeloRecencia recencia={g.recencia} /></td>
                      <td className="numero">{g.ordens}</td>
                      <td className="numero">{valorEmReais(g.faturado)}</td>
                      <td className="numero"><Percentual valor={g.fatiaPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </>
        )}
      </div></div>
    </>
  )
}
