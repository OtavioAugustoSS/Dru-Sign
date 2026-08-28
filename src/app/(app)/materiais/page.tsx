import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarMateriais } from '@/infra/materiais/repositorio'
import { rotuloUnidade } from '@/infra/materiais/unidades'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { FormMaterial } from './form-material'
import { alternarAtivo } from './actions'

export const metadata: Metadata = { title: 'Materiais e preços' }

export default async function PaginaMateriais() {
  const usuario = await exigirPapel('administracao')
  const materiais = await listarMateriais(usuario.empresaId, { incluirInativos: true })

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Administração</div>
          <h2 className="page-title">Materiais e preços</h2>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card mb-3">
            <div className="card-header"><h3 className="card-title">Novo material</h3></div>
            <div className="card-body"><FormMaterial /></div>
          </div>

          {materiais.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty">
                  <p className="empty-title">O catálogo nasce vazio</p>
                  <p className="empty-subtitle text-secondary">
                    É tabela de preço, não estoque. Cadastre cada material com o preço e como ele é cobrado: por m², por unidade ou por metro linear.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr><th>Material</th><th>Categoria</th><th className="text-end">Preço</th><th>Cobrado</th><th className="w-1"></th></tr>
                  </thead>
                  <tbody>
                    {materiais.map((m) => (
                      <tr key={m.id} className={m.ativo ? '' : 'text-secondary'}>
                        <td>
                          <Link href={`/materiais/${m.id}`} className="text-reset fw-medium">{m.nome}</Link>
                          {m.ativo ? null : <span className="badge bg-secondary-lt ms-2">inativo</span>}
                        </td>
                        <td>{m.categoria ?? ''}</td>
                        <td className="numero">{formatarMoeda(m.preco)}</td>
                        <td>{rotuloUnidade(m.unidadeCobranca)}</td>
                        <td>
                          <form action={alternarAtivo}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="ativo" value={m.ativo ? '0' : '1'} />
                            <button type="submit" className="btn btn-sm btn-ghost-secondary">{m.ativo ? 'Desativar' : 'Reativar'}</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
