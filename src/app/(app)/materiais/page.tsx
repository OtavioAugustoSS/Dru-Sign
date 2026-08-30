import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { categoriasDeMateriais, contagensDeMateriais, contarMateriais, listarMateriais } from '@/infra/materiais/repositorio'
import { rotuloUnidade } from '@/infra/materiais/unidades'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { contar } from '@/componentes/plural'
import { Anotacao } from '@/componentes/situacao'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { FormMaterial } from './form-material'
import { alternarAtivo } from './actions'

export const metadata: Metadata = { title: 'Materiais e preços' }

export default async function PaginaMateriais({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; inativos?: string; pagina?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const { q = '', categoria = '', inativos, pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const filtros = { q, categoria: categoria || undefined, incluirInativos: inativos !== '0' }
  const filtrando = q !== '' || categoria !== '' || inativos === '0'

  const [materiais, total, categorias, contagens] = await Promise.all([
    listarMateriais(usuario.empresaId, { ...filtros, limite: POR_PAGINA, pagina }),
    contarMateriais(usuario.empresaId, filtros),
    categoriasDeMateriais(usuario.empresaId),
    contagensDeMateriais(usuario.empresaId),
  ])

  return (
    <>
      <CabecalhoPagina pretitulo="Configuração" titulo="Materiais e preços" />
      <CorpoPagina>
        <div className="card mb-3">
          <div className="card-header"><h2 className="card-title">Novo material</h2></div>
          <div className="card-body"><FormMaterial /></div>
        </div>

        {/* O filtro so aparece quando ha catalogo para filtrar: com a tabela
            vazia ele seria um formulario sem nada para achar. */}
        {contagens.ativos + contagens.inativos > 0 ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-4">
                <CartaoIndicador rotulo="No catálogo" valor={contagens.ativos} href="/materiais?inativos=0" nota="preços em uso" />
              </div>
              <div className="col-6 col-lg-4">
                <CartaoIndicador rotulo="Categorias" valor={contagens.categorias} nota="como o catálogo está dividido" />
              </div>
              <div className="col-6 col-lg-4">
                <CartaoIndicador rotulo="Desativados" valor={contagens.inativos} nota="fora da entrada assistida" />
              </div>
            </div>

            <form method="get" className="card mb-3" role="search">
              <div className="card-body row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label" htmlFor="q">Buscar</label>
                  <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Nome ou categoria" />
                </div>
                <div className="col-md-3">
                  <label className="form-label" htmlFor="categoria">Categoria</label>
                  <select id="categoria" name="categoria" className="form-select" defaultValue={categoria}>
                    <option value="">Todas</option>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-check">
                    {/* Invertido de proposito: o padrao e ver tudo, porque quem
                        abre esta tela costuma estar procurando o que desativou. */}
                    <input className="form-check-input" type="checkbox" name="inativos" value="0" defaultChecked={inativos === '0'} />
                    <span className="form-check-label">Só os ativos</span>
                  </label>
                </div>
                <div className="col-md-2 d-flex gap-2">
                  <button type="submit" className="btn btn-primary">Filtrar</button>
                  <Link href="/materiais" className="btn">Limpar</Link>
                </div>
              </div>
            </form>
          </>
        ) : null}

        {materiais.length === 0 ? (
          <EstadoVazio
            titulo={filtrando ? 'Nenhum material com esse filtro' : 'O catálogo está vazio'}
            descricao={
              filtrando
                ? 'A busca olha o nome e a categoria.'
                : 'É tabela de preço, não estoque: não tem quantidade nem saldo, só quanto custa e como se cobra. E dá para trabalhar sem ele: o preço pode ser digitado na hora, item por item.'
            }
            acoes={filtrando ? <Link href="/materiais" className="btn">Limpar o filtro</Link> : null}
          />
        ) : (
          <CartaoTabela
            rotulo="Materiais e preços"
            aoLado={<span className="text-secondary">{contar(total, 'material', 'materiais')}</span>}
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/materiais"
                parametros={{ q, categoria, inativos }}
              />
            }
            colunas={
              <>
                <th>Material</th>
                <th>Categoria</th>
                <th className="text-end">Preço</th>
                <th>Cobrado</th>
                <th className="w-1"></th>
              </>
            }
          >
            {materiais.map((m) => (
              <tr key={m.id} className={m.ativo ? '' : 'text-secondary'}>
                <td>
                  <Link href={`/materiais/${m.id}`} className="text-reset fw-medium">{m.nome}</Link>
                  {m.ativo ? null : <Anotacao>inativo</Anotacao>}
                </td>
                <td>{m.categoria ?? ''}</td>
                <td className="numero"><Dinheiro valor={m.preco} /></td>
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
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
