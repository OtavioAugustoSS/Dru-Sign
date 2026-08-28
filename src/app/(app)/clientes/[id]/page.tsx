import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { obterCliente } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import { arquivar, reativar } from '../actions'

export const metadata: Metadata = { title: 'Ficha do cliente' }

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const c = await obterCliente(usuario.empresaId, id)
  if (!c) notFound()

  const endereco = [c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' · ')

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Cliente</div>
              <h2 className="page-title">
                {c.nome}
                {c.apelido ? <span className="badge bg-primary-lt ms-2">{c.apelido}</span> : null}
                {c.arquivadoEm ? <span className="badge bg-secondary-lt ms-2">arquivado</span> : null}
              </h2>
            </div>
            <div className="col-auto d-flex gap-2">
              <Link href={`/clientes/${c.id}/editar`} className="btn">Editar</Link>
              <form action={c.arquivadoEm ? reativar : arquivar}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn btn-ghost-secondary">
                  {c.arquivadoEm ? 'Reativar' : 'Arquivar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h3 className="card-title">Contato</h3></div>
                <div className="card-body">
                  <dl className="row">
                    <dt className="col-4">Telefones</dt>
                    <dd className="col-8">
                      {c.telefones.length === 0 ? <span className="text-secondary">nenhum</span> : null}
                      {c.telefones.map((t) => (
                        <div key={t.original}>
                          {t.normalizado ? formatarTelefone(t.normalizado) : <span className="text-secondary">{t.original} (não discável)</span>}
                          {t.inferido ? <small className="text-secondary ms-2">nono dígito completado; no legado: {t.original}</small> : null}
                        </div>
                      ))}
                    </dd>
                    <dt className="col-4">Contato</dt><dd className="col-8">{c.contato ?? '—'}</dd>
                    <dt className="col-4">E-mail</dt><dd className="col-8">{c.email ?? '—'}</dd>
                    <dt className="col-4">Documento</dt><dd className="col-8">{c.documento ? formatarDocumento(c.documento) : '—'}</dd>
                    <dt className="col-4">Endereço</dt><dd className="col-8">{endereco || '—'}</dd>
                    <dt className="col-4">Cadastro</dt>
                    <dd className="col-8">
                      {/* Data do legado foi gravada a meia-noite UTC; cadastro novo e no fuso da loja. */}
                      {c.criadoEm.toLocaleDateString('pt-BR', { timeZone: c.codigoLegado !== null ? 'UTC' : 'America/Sao_Paulo' })}
                      {c.codigoLegado !== null ? <small className="text-secondary ms-2">legado nº {c.codigoLegado}</small> : null}
                    </dd>
                  </dl>
                  {c.observacoes ? <><h4>Observações</h4><p className="text-secondary" style={{ whiteSpace: 'pre-line' }}>{c.observacoes}</p></> : null}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h3 className="card-title">Histórico de ordens</h3></div>
                <div className="card-body">
                  <div className="empty">
                    <p className="empty-title">Ainda sem ordens</p>
                    <p className="empty-subtitle text-secondary">
                      As ordens novas aparecem aqui a partir da Fase 3; as 18.443 do sistema antigo, na Fase 6.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
