import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { valorEmReais } from '@/componentes/dinheiro'
import { emPercentual } from '@/componentes/percentual'
import { carregarOperacao } from '@/infra/operacao/indicadores'
import { ErroDeValidacao } from '@/domain/precificacao/erros'

export const metadata: Metadata = { title: 'Indicadores' }


/** Cada cartao carrega o alvo da spec (secao 11): o numero sozinho nao diz se esta bom. */
function Cartao({ titulo, valor, alvo, testid, cor }: { titulo: string; valor: string; alvo: string; testid: string; cor?: string }) {
  return (
    <div className="col-md-4">
      <div className="card card-sm h-100"><div className="card-body">
        <div className="subheader">{titulo}</div>
        <div className={`h1 mb-0 numero ${cor ?? ''}`} data-testid={testid}>{valor}</div>
        <div className="text-secondary small">{alvo}</div>
      </div></div>
    </div>
  )
}

export default async function PaginaOperacao({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { de = '', ate = '' } = await searchParams
  let erro: string | null = null
  let dados
  try {
    dados = await carregarOperacao(usuario.empresaId, de && ate ? { de, ate } : undefined)
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    dados = await carregarOperacao(usuario.empresaId)
  }
  const { indicadores: i, anos } = dados

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h1 className="page-title">Indicadores</h1>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <form method="get" className="card mb-3">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-3"><label className="form-label" htmlFor="de">Aberta de</label><input id="de" type="date" name="de" className="form-control" defaultValue={dados.de ?? ''} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="ate">até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={dados.ate ?? ''} /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-primary">Mostrar</button></div>
            <div className="col-12 text-secondary small">{dados.de ? `Período de ${dados.de} a ${dados.ate}.` : 'Sem período: tudo o que existe no sistema.'}</div>
            {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando tudo.</div> : null}
          </div>
        </form>

        <div className="row g-3 mb-3">
          <Cartao titulo="Ordens que ainda não foram finalizadas" valor={emPercentual(i.naoFinalizadasPct)} alvo="Alvo: abaixo de 5%. No legado, 29,4% em 2025." testid="nao-finalizadas" cor={Number(i.naoFinalizadasPct) > 5 ? 'text-danger' : 'text-success'} />
          <Cartao titulo="Valor parado em ordens não cobradas" valor={valorEmReais(i.valorParado)} alvo="Alvo: perto de zero. No legado, R$ 207.795." testid="valor-parado" />
          <Cartao titulo="Ordens com item estruturado" valor={emPercentual(i.comItemPct)} alvo="Alvo: acima de 90%. No legado, 0%." testid="com-item" cor={Number(i.comItemPct) >= 90 ? 'text-success' : ''} />
          <Cartao titulo="Prazo de entrega" valor={i.prazoMedianoDias === null ? '—' : `${i.prazoMedianoDias} dias`} alvo={i.prazoP90Dias === null ? 'Sem ordem finalizada ainda.' : `9 de 10 saem em até ${i.prazoP90Dias} dias. No legado: 13 e 78.`} testid="prazo" />
          <Cartao titulo="Pessoas usando o sistema" valor={String(i.pessoas)} alvo="Alvo: 2 ou mais. No legado, uma pessoa fazia 84,6% das ordens." testid="pessoas" />
          <Cartao titulo="Recebido" valor={valorEmReais(i.recebido)} alvo={`De ${valorEmReais(i.faturado)} faturados.`} testid="recebido" />
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">Ano a ano</h2></div>
          {anos.length === 0 ? (
            <div className="card-body text-secondary">Nenhuma ordem ainda.</div>
          ) : (
            <>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ano a ano">
                <thead><tr><th>Ano</th><th className="text-end">Ordens</th><th className="text-end">Finalizadas</th><th className="text-end">Faturado</th><th className="text-end">Recebido</th><th className="text-end">Ticket médio</th></tr></thead>
                <tbody>
                  {anos.map((a) => (
                    <tr key={a.ano}>
                      <td className="numero">{a.ano}</td>
                      <td className="numero">{a.ordens}</td>
                      <td className="numero">{a.concluidas}</td>
                      <td className="numero">{valorEmReais(a.faturado)}</td>
                      <td className="numero">{valorEmReais(a.recebido)}</td>
                      <td className="numero">{valorEmReais(a.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {anos.length === 1 ? <div className="card-body text-secondary small">Só existe um ano porque o histórico do sistema antigo ainda não foi importado — isso é a Fase 6.</div> : null}
            </>
          )}
        </div>
      </div></div>
    </>
  )
}
