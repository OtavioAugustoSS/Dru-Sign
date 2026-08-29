import type { Metadata } from 'next'
import Link from 'next/link'
import { IconDownload } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { valorEmReais } from '@/componentes/dinheiro'
import { montarRelatorio } from '@/infra/caixa/relatorio'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { mesCalendario } from '@/domain/ordem/datas'
import type { ContaDoRelatorio } from '@/domain/caixa/relatorio'

export const metadata: Metadata = { title: 'Relatório para o contador' }


function Tabela({ titulo, contas, total, rotulo }: { titulo: string; contas: ContaDoRelatorio[]; total: string; rotulo: string }) {
  return (
    <div className="card mb-3">
      <div className="card-header"><h2 className="card-title">{titulo}</h2><span className="ms-auto numero fw-bold" data-testid={rotulo}>{valorEmReais(total)}</span></div>
      {contas.length === 0 ? <div className="card-body text-secondary">Nenhum lançamento no período.</div> : (
        <div className="table-responsive"><table className="table table-vcenter card-table" aria-label={titulo}>
          <thead><tr><th className="w-1">Código</th><th>Conta</th><th className="text-end">Lançamentos</th><th className="text-end">Total</th></tr></thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.codigo}><td className="numero">{c.codigo}</td><td>{c.nome}</td><td className="numero">{c.lancamentos}</td><td className="numero">{valorEmReais(c.total)}</td></tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

export default async function PaginaContador({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const mes = mesCalendario(new Date())
  const { de = mes.de, ate = mes.ate } = await searchParams
  let erro: string | null = null
  let periodo = { de, ate }
  let relatorio
  try {
    relatorio = await montarRelatorio(usuario.empresaId, periodo)
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    periodo = mes
    relatorio = await montarRelatorio(usuario.empresaId, mes)
  }

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col"><div className="page-pretitle">Financeiro</div><h1 className="page-title">Relatório para o contador</h1></div>
          <div className="col-auto">
            <a className="btn btn-primary" href={`/financeiro/contador/csv?de=${periodo.de}&ate=${periodo.ate}`}><IconDownload className="icon" /> Baixar CSV</a>
          </div>
        </div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-3"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={periodo.de} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={periodo.ate} /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            <div className="col-md-3"><Link href="/financeiro" className="btn btn-link px-0">Ver o livro-caixa</Link></div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando o mês atual.</div> : null}
          </div>
        </form>

        <Tabela titulo="Entradas por conta" contas={relatorio.entradas} total={relatorio.totalEntradas} rotulo="total-entradas" />
        <Tabela titulo="Saídas por conta" contas={relatorio.saidas} total={relatorio.totalSaidas} rotulo="total-saidas" />

        <div className="card"><div className="card-body d-flex justify-content-between align-items-baseline">
          <span className="h3 mb-0">Saldo do período</span>
          <span className="h1 mb-0 numero" data-testid="saldo">{valorEmReais(relatorio.saldo)}</span>
        </div></div>
        <p className="text-secondary small mt-2">Lançamento estornado não aparece: para o contador ele nunca foi movimento.</p>
      </div></div>
    </>
  )
}
