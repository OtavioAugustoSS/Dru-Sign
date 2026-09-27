import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarFamilias } from '@/infra/precificacao/repositorio'
import { rotuloUnidade } from '@/infra/materiais/unidades'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { contar } from '@/componentes/plural'
import { FormFamilia } from './form-familia'
import { excluir } from './actions'

export const metadata: Metadata = { title: 'Precificação' }

export default async function PaginaPrecificacao({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; n?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const [familias, { erro, n }] = await Promise.all([listarFamilias(usuario.empresaId), searchParams])

  const totalMateriais = familias.reduce((s, f) => s + f.materiais, 0)
  const totalTravados = familias.reduce((s, f) => s + f.travados, 0)
  const totalSemCusto = familias.reduce((s, f) => s + f.semCusto, 0)

  return (
    <>
      <CabecalhoPagina
        pretitulo="Configuração"
        titulo="Precificação"
        descricao="A política de preço da empresa: cada família calcula a venda a partir do custo."
      />
      <CorpoPagina>
        {erro === 'materiais' ? (
          <div className="alert alert-warning" role="alert">
            Essa família não foi excluída: {n ?? 'alguns'} {n === '1' ? 'material ainda usa' : 'materiais ainda usam'} ela.
            Mude esses materiais de família primeiro — apagar aqui soltaria o preço deles sem avisar ninguém.
          </div>
        ) : null}

        <div className="card mb-3">
          <div className="card-header"><h2 className="card-title">Nova família</h2></div>
          <div className="card-body"><FormFamilia /></div>
        </div>

        {familias.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma família de preço"
            descricao="A família guarda a margem, o arredondamento e o mínimo de cobrança de um grupo de materiais. Sem ela, cada preço continua sendo digitado à mão, um por um."
          />
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Famílias" valor={familias.length} nota="políticas de preço" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Materiais cobertos" valor={totalMateriais} href="/materiais" nota="seguem uma família" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Preço travado" valor={totalTravados} nota="não seguem a fórmula" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Sem custo" valor={totalSemCusto} nota="não dá para calcular" />
              </div>
            </div>

            <div className="row row-cards">
              {familias.map((f) => (
                <div className="col-md-6" key={f.id}>
                  <div className="card h-100">
                    <div className="card-body">
                      <div className="d-flex align-items-baseline justify-content-between mb-2">
                        <h3 className="card-title mb-0">
                          <Link href={`/precificacao/${f.id}`} className="text-reset">{f.nome}</Link>
                        </h3>
                        <span className="text-secondary small">
                          {contar(f.materiais, 'material', 'materiais')} · {rotuloUnidade(f.unidadePadrao)}
                        </span>
                      </div>

                      <div className="datagrid">
                        <div className="datagrid-item">
                          <div className="datagrid-title">Margem</div>
                          <div className="datagrid-content numero">{f.margem.toFixed(0)}%</div>
                        </div>
                        <div className="datagrid-item">
                          <div className="datagrid-title">Arredondamento</div>
                          <div className="datagrid-content numero"><Dinheiro valor={f.arredondamento} /></div>
                        </div>
                        <div className="datagrid-item">
                          <div className="datagrid-title">Mínimo cobrável</div>
                          <div className="datagrid-content numero">
                            {f.minimoCobranca === null ? (
                              <span className="text-secondary">sem mínimo</span>
                            ) : (
                              // A unidade importa: "1,00" sozinho nao diz se e metro ou metro quadrado.
                              `${f.minimoCobranca.toFixed(2).replace('.', ',')} ${f.unidadePadrao === 'm2' ? 'm²' : f.unidadePadrao === 'metro_linear' ? 'm' : 'un'}`
                            )}
                          </div>
                        </div>
                      </div>

                      {/* A faixa que a familia produz hoje: e o retrato que evita
                          abrir cada material para saber se a margem esta sa. */}
                      <div className="mt-3 pt-3 border-top">
                        {f.custoMin === null ? (
                          <div className="text-secondary small">
                            Nenhum material desta família tem custo informado — não há o que calcular ainda.
                          </div>
                        ) : (
                          <div className="small">
                            <span className="text-secondary">custo</span>{' '}
                            <span className="numero"><Dinheiro valor={f.custoMin} /> – <Dinheiro valor={f.custoMax!} /></span>
                            <span className="text-secondary mx-2">→</span>
                            <span className="text-secondary">venda</span>{' '}
                            <span className="numero fw-medium"><Dinheiro valor={f.vendaMin!} /> – <Dinheiro valor={f.vendaMax!} /></span>
                          </div>
                        )}
                        {/* Quando nenhum material tem custo, a linha de cima ja explicou
                            tudo -- repetir "N sem custo" aqui seria dizer duas vezes. */}
                        {f.custoMin !== null && f.travados + f.semCusto > 0 ? (
                          <div className="text-secondary small mt-1">
                            {f.travados > 0 ? `${f.travados} com preço travado` : ''}
                            {f.travados > 0 && f.semCusto > 0 ? ' · ' : ''}
                            {f.semCusto > 0 ? `${f.semCusto} sem custo` : ''}
                            {' '}
                            {f.travados + f.semCusto === 1 ? 'fica' : 'ficam'} de fora do recálculo
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="card-footer d-flex gap-2">
                      <Link href={`/precificacao/${f.id}`} className="btn btn-primary flex-fill">Ajustar preços</Link>
                      {/* So aparece para familia sem material: com vinculo a action recusa,
                          e um botao que sempre recusa e um botao que engana. */}
                      {f.materiais === 0 ? (
                        <form action={excluir}>
                          <input type="hidden" name="id" value={f.id} />
                          <button type="submit" className="btn btn-ghost-danger">Excluir</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CorpoPagina>
    </>
  )
}
