import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterMaterial } from '@/infra/materiais/repositorio'
import { historicoDoMaterial, listarFamilias } from '@/infra/precificacao/repositorio'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { Dinheiro } from '@/componentes/dinheiro'
import { FormMaterial } from '../form-material'

export const metadata: Metadata = { title: 'Editar material' }

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default async function PaginaEditarMaterial({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ foco?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const { id } = await params
  const { foco } = await searchParams
  const m = await obterMaterial(usuario.empresaId, id)
  if (!m) notFound()

  const [familias, historico] = await Promise.all([
    listarFamilias(usuario.empresaId),
    historicoDoMaterial(usuario.empresaId, id),
  ])

  return (
    <>
      <CabecalhoPagina voltar={{ href: '/materiais', rotulo: 'Materiais e preços' }} titulo={`Editar ${m.nome}`} />
      <CorpoPagina>
        <div className="card mb-3">
          <div className="card-body">
            <FormMaterial
              id={m.id}
              foco={foco === 'custo' || foco === 'preco' ? foco : undefined}
              familias={familias.map((f) => ({
                id: f.id,
                nome: f.nome,
                unidadePadrao: f.unidadePadrao,
                margem: f.margem.toFixed(),
                arredondamento: f.arredondamento.toFixed(),
              }))}
              inicial={{
                nome: m.nome,
                categoria: m.categoria ?? '',
                preco: m.preco.toFixed(2).replace('.', ','),
                custo: m.custo === null ? '' : m.custo.toFixed(2).replace('.', ','),
                familiaPrecoId: m.familiaPrecoId ?? '',
                precoTravado: m.precoTravado,
                unidadeCobranca: m.unidadeCobranca,
              }}
            />
          </div>
        </div>

        {/* O historico responde "por que este orcamento saiu diferente do do mes passado".
            So aparece quando ha o que contar: um cartao vazio nao informa nada. */}
        {historico.length > 0 ? (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Histórico de preço</h3></div>
            <div className="table-responsive">
              <table className="table card-table table-vcenter">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th className="text-end">De</th>
                    <th className="text-end">Para</th>
                    <th>Motivo</th>
                    <th>Quem</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h, i) => (
                    <tr key={i}>
                      <td className="text-secondary">{DATA_HORA.format(h.criadoEm)}</td>
                      <td className="numero text-secondary"><Dinheiro valor={h.de} /></td>
                      <td className="numero fw-medium"><Dinheiro valor={h.para} /></td>
                      <td>{h.motivo}</td>
                      <td className="text-secondary">{h.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CorpoPagina>
    </>
  )
}
