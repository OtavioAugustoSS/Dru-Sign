import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { buscarClientes } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'

export const metadata: Metadata = { title: 'Clientes' }

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; arquivados?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', arquivados } = await searchParams
  const clientes = await buscarClientes(usuario.empresaId, q, { incluirArquivados: arquivados === '1' })

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Clientes</h2>
            </div>
            <div className="col-auto">
              <Link href="/clientes/novo" className="btn btn-primary">
                <IconPlus className="icon" /> Novo cliente
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" className="mb-3" role="search">
            <div className="input-icon">
              <span className="input-icon-addon"><IconSearch className="icon" /></span>
              <input
                type="search" name="q" className="form-control form-control-lg" defaultValue={q}
                placeholder="Nome, apelido, telefone ou CPF/CNPJ" aria-label="Buscar cliente" autoFocus
              />
            </div>
            <label className="form-check mt-2">
              <input className="form-check-input" type="checkbox" name="arquivados" value="1" defaultChecked={arquivados === '1'} />
              <span className="form-check-label">Incluir arquivados</span>
            </label>
          </form>

          {clientes.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty">
                  <p className="empty-title">{q ? `Nenhum cliente com “${q}”` : 'Nenhum cliente cadastrado'}</p>
                  <p className="empty-subtitle text-secondary">
                    A busca olha nome, apelido, telefone e documento. Se é cliente novo, cadastre.
                  </p>
                  <div className="empty-action">
                    <Link href="/clientes/novo" className="btn btn-primary">Cadastrar cliente</Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Telefones</th>
                      <th>Documento</th>
                      <th className="w-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="text-reset fw-medium">{c.nome}</Link>
                          {c.apelido ? <span className="badge bg-primary-lt ms-2">{c.apelido}</span> : null}
                          {c.arquivadoEm ? <span className="badge bg-secondary-lt ms-2">arquivado</span> : null}
                        </td>
                        <td className="text-secondary">
                          {c.telefones.map((t) => (
                            <span key={t.original} className="me-2" title={t.inferido ? 'Nono dígito completado pelo sistema' : undefined}>
                              {t.normalizado ? formatarTelefone(t.normalizado) : t.original}{t.inferido ? '*' : ''}
                            </span>
                          ))}
                        </td>
                        <td className="text-secondary">{c.documento ? formatarDocumento(c.documento) : ''}</td>
                        <td><Link href={`/clientes/${c.id}`}>Ficha</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {clientes.length >= 50 ? (
                <div className="card-footer text-secondary">Mostrando os primeiros 50. Refine a busca.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
