import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarContas } from '@/infra/caixa/plano'
import { ROTULO_TIPO_CONTA } from '@/domain/caixa/lancamento'
import { FormConta } from './form-conta'
import { AcoesConta } from './acoes-conta'

export const metadata: Metadata = { title: 'Plano de contas' }

export default async function PaginaPlano({ searchParams }: { searchParams: Promise<{ inativas?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { inativas } = await searchParams
  const contas = await listarContas(usuario.empresaId, { incluirInativas: inativas === '1' })
  const grupos = [...new Set(contas.map((c) => c.grupo))]
  const semVendas = !contas.some((c) => c.recebeVendas)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl"><div className="page-pretitle">Administração</div><h2 className="page-title">Plano de contas</h2></div></div>
      <div className="page-body">
        <div className="container-xl">
          {semVendas ? <div className="alert alert-warning" role="alert">Nenhuma conta recebe as vendas. Escolha uma conta de receita e clique em "Usar para recebimentos" — sem isso, receber é recusado.</div> : null}
          <div className="card mb-3"><div className="card-body"><FormConta grupos={grupos} /></div></div>
          <form method="get" className="mb-2">
            <label className="form-check"><input className="form-check-input" type="checkbox" name="inativas" value="1" defaultChecked={inativas === '1'} onChange={undefined} /><span className="form-check-label">Mostrar desativadas</span></label>
            <button type="submit" className="btn btn-sm btn-link px-0">Atualizar</button>
          </form>
          {contas.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Plano de contas vazio</p>
              <p className="empty-subtitle text-secondary">Importe as 48 contas do legado com <code>npm run importar:plano</code> ou crie a primeira acima.</p>
            </div></div></div>
          ) : grupos.map((g) => (
            <div className="card mb-3" key={g}>
              <div className="card-header"><h3 className="card-title">{g}</h3></div>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label={`Contas de ${g}`}>
                <thead><tr><th className="w-1">Código</th><th>Conta</th><th>Tipo</th><th className="w-1"></th></tr></thead>
                <tbody>
                  {contas.filter((c) => c.grupo === g).map((c) => (
                    <tr key={c.id} className={c.ativa ? '' : 'text-secondary'}>
                      <td className="numero">{c.codigo}</td>
                      <td>{c.nome}{c.recebeVendas ? <span className="badge bg-success-lt ms-2">recebe as vendas</span> : null}{c.ativa ? null : <span className="badge bg-secondary-lt ms-2">desativada</span>}</td>
                      <td><span className={`badge ${c.tipo === 'receita' ? 'bg-success-lt' : 'bg-danger-lt'}`}>{ROTULO_TIPO_CONTA[c.tipo]}</span></td>
                      <td><AcoesConta contaId={c.id} ativa={c.ativa} receita={c.tipo === 'receita'} recebeVendas={c.recebeVendas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
