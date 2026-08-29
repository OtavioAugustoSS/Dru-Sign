import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { Selo, SeloApelido } from '@/componentes/selo'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { Dinheiro } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { limparTextoLegado } from '@/componentes/texto-legado'
import { obterCliente } from '@/infra/clientes/repositorio'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { historicoDoCliente } from '@/infra/legado/consulta'
import { arquivar, reativar } from '../actions'

export const metadata: Metadata = { title: 'Ficha do cliente' }

export default async function PaginaFichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const [c, antigas] = await Promise.all([obterCliente(usuario.empresaId, id), historicoDoCliente(usuario.empresaId, id)])
  if (!c) notFound()

  const endereco = [c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' · ')

  return (
    <>
      <CabecalhoPagina
        pretitulo="Clientes"
        titulo={
          <>
            {c.nome}
            <SeloApelido apelido={c.apelido} />
            {c.arquivadoEm ? <Selo tom="neutro" className="ms-2">arquivado</Selo> : null}
          </>
        }
        acoes={
          <>
            <Link href={`/clientes/${c.id}/editar`} className="btn">Editar</Link>
            <form action={c.arquivadoEm ? reativar : arquivar}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="btn btn-ghost-secondary">
                {c.arquivadoEm ? 'Reativar' : 'Arquivar'}
              </button>
            </form>
          </>
        }
      />
      <CorpoPagina>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h2 className="card-title">Contato</h2></div>
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
                  {c.observacoes ? <><h3 className="h4">Observações</h3><p className="text-secondary texto-original">{c.observacoes}</p></> : null}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header"><h2 className="card-title">No sistema antigo</h2>{antigas.length > 0 ? <span className="ms-auto text-secondary">{antigas.length} ordens até 2026</span> : null}</div>
                {antigas.length === 0 ? (
                  <div className="card-body">
                    <div className="empty">
                      <p className="empty-title">Nada no arquivo para este cliente</p>
                      <p className="empty-subtitle text-secondary">
                        As ordens de 2012 a 2026 entram com <code>npm run importar:ordens</code> e aparecem aqui
                        quando o código do cadastro antigo bate com o deste cliente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens antigas do cliente">
                    <thead><tr><th>Nº</th><th>Entrada</th><th>O que foi feito</th><th className="text-end">Total</th></tr></thead>
                    <tbody>
                      {antigas.map((l) => (
                        <tr key={l.id}>
                          <td className="numero"><NumeroOs numero={l.numero} /></td>
                          <td className="text-secondary">{formatarDataCalendario(new Date(l.dataEntrada))}</td>
                          <td><div className="texto-original">{limparTextoLegado(l.texto)}</div></td>
                          <td className="numero"><Dinheiro valor={l.total} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </div>
            </div>
          </div>
      </CorpoPagina>
    </>
  )
}
