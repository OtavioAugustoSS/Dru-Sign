import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { valorEmReais } from '@/componentes/dinheiro'
import { buscarHistorico } from '@/infra/legado/consulta'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'

export const metadata: Metadata = { title: 'Histórico' }


export default async function PaginaHistorico({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string }> }) {
  const usuario = await exigirUsuario()
  const { q = '', de = '', ate = '' } = await searchParams
  let erro: string | null = null
  let historico
  try {
    historico = await buscarHistorico(usuario.empresaId, { q, de: de || undefined, ate: ate || undefined })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    historico = await buscarHistorico(usuario.empresaId, { q })
  }

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Arquivo</div>
        <h2 className="page-title">Histórico do sistema antigo</h2>
        <div className="text-secondary">Somente leitura. É o que a loja fez de 2012 a 2026, com o texto exatamente como foi digitado.</div>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3" role="search">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="q">Buscar</label>
              <div className="input-icon">
                <span className="input-icon-addon"><IconSearch className="icon" /></span>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou o que estava escrito" autoFocus />
              </div>
            </div>
            <div className="col-md-2"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={de} /></div>
            <div className="col-md-2"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} /></div>
            <div className="col-md-3 d-flex gap-2"><button type="submit" className="btn btn-primary">Buscar</button><Link href="/historico" className="btn">Limpar</Link></div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — ignorando o período.</div> : null}
          </div>
        </form>

        {historico.linhas.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty">
            <p className="empty-title">{q || de ? 'Nada no arquivo com esse filtro' : 'O arquivo está vazio'}</p>
            <p className="empty-subtitle text-secondary">
              {q || de
                ? 'A busca olha o número, o nome do cliente e o texto da ordem. Tente um pedaço menor.'
                : 'As 18.443 ordens do sistema antigo entram com npm run importar:ordens. Enquanto não rodar, só existe o que foi feito aqui.'}
            </p>
          </div></div></div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <div className="text-secondary">{historico.encontradas} ordens{historico.linhas.length < historico.encontradas ? ` · mostrando as ${historico.linhas.length} mais recentes` : ''}</div>
              <div className="numero fw-bold" data-testid="soma-historico">{valorEmReais(historico.somaTotal)}</div>
            </div>
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table" aria-label="Ordens do sistema antigo">
                <thead><tr><th>Nº</th><th>Entrada</th><th>Cliente</th><th>O que foi feito</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {historico.linhas.map((l) => (
                    <tr key={l.id}>
                      <td className="numero">{formatarNumeroOs(l.numero)}</td>
                      <td className="text-secondary">
                        {formatarDataCalendario(new Date(l.dataEntrada))}
                        {l.dataSaida ? <div className="small">saiu {formatarDataCalendario(new Date(l.dataSaida))}{l.dataSaidaSuspeita ? ' ⚠' : ''}</div> : null}
                        {l.dataSaidaTexto ? <div className="small text-danger">saída ilegível: {l.dataSaidaTexto}</div> : null}
                      </td>
                      <td>
                        {l.clienteId ? <Link href={`/clientes/${l.clienteId}`} className="text-reset">{l.clienteNome}</Link> : l.clienteNome}
                        {l.nomeDestruido ? <div className="small text-secondary">o sistema antigo apagou o nome ao cancelar</div> : null}
                      </td>
                      <td><div style={{ whiteSpace: 'pre-line' }}>{l.texto}</div>{l.situacao ? <div className="small text-secondary">{l.situacao}</div> : null}</td>
                      <td className="numero">{valorEmReais(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          </>
        )}
      </div></div>
    </>
  )
}
