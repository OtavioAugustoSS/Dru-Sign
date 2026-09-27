import type { Metadata } from 'next'
import Link from 'next/link'
import { IconLock } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { categoriasDeMateriais, contagensDeMateriais, contarMateriais, listarMateriais } from '@/infra/materiais/repositorio'
import { listarFamilias } from '@/infra/precificacao/repositorio'
import { rotuloUnidade } from '@/infra/materiais/unidades'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { Paginacao, PaginacaoCompacta, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { ColunaOrdenavel, lerOrdenacao } from '@/componentes/coluna-ordenavel'
import { contar } from '@/componentes/plural'
import { Anotacao } from '@/componentes/situacao'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { FormMaterial } from './form-material'
import { AcoesMaterial } from './acoes-material'

export const metadata: Metadata = { title: 'Materiais e preços' }

/** O que a tela deixa ordenar. "Cobrado" fica de fora: unidade nao tem ordem natural. */
const ORDENAVEIS = ['nome', 'categoria', 'preco', 'custo'] as const

export default async function PaginaMateriais({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; familia?: string; inativos?: string; pagina?: string; ordenar?: string; direcao?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const { q = '', categoria = '', familia = '', inativos, pagina: paginaCrua, ordenar, direcao } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const ordem = lerOrdenacao(ORDENAVEIS, { campo: 'categoria', direcao: 'asc' }, { ordenar, direcao })
  const filtros = { q, categoria: categoria || undefined, familiaPrecoId: familia || undefined, incluirInativos: inativos !== '0', ordenar: ordem.campo, direcao: ordem.direcao }
  const contexto = { q, categoria, familia, inativos, ordenar: ordem.campo, direcao: ordem.direcao }
  const filtrando = q !== '' || categoria !== '' || familia !== '' || inativos === '0'

  const [materiais, total, categorias, contagens, familias] = await Promise.all([
    listarMateriais(usuario.empresaId, { ...filtros, limite: POR_PAGINA, pagina }),
    contarMateriais(usuario.empresaId, filtros),
    categoriasDeMateriais(usuario.empresaId),
    contagensDeMateriais(usuario.empresaId),
    listarFamilias(usuario.empresaId),
  ])

  // Decimal nao atravessa a fronteira servidor -> cliente; o formulario recebe strings.
  const familiasParaForm = familias.map((f) => ({
    id: f.id,
    nome: f.nome,
    unidadePadrao: f.unidadePadrao,
    margem: f.margem.toFixed(),
    arredondamento: f.arredondamento.toFixed(),
  }))

  return (
    <>
      <CabecalhoPagina
        pretitulo="Configuração"
        titulo="Materiais e preços"
        descricao="Clique em qualquer valor da tabela para ir direto onde ele se muda."
      />
      <CorpoPagina>
        <div className="card mb-3">
          <div className="card-header"><h2 className="card-title">Novo material</h2></div>
          <div className="card-body"><FormMaterial familias={familiasParaForm} /></div>
        </div>

        {/* O filtro so aparece quando ha catalogo para filtrar: com a tabela
            vazia ele seria um formulario sem nada para achar. */}
        {contagens.ativos + contagens.inativos > 0 ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="No catálogo" valor={contagens.ativos} href="/materiais?inativos=0" nota="preços em uso" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Categorias" valor={contagens.categorias} nota="como o catálogo está dividido" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Famílias de preço" valor={familias.length} href="/precificacao" nota="calculam a venda" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Desativados" valor={contagens.inativos} nota="fora da entrada assistida" />
              </div>
            </div>

            <form method="get" className="card mb-3" role="search">
              <div className="card-body row g-2 align-items-end">
                <div className="col-md-4">
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
                  <label className="form-label" htmlFor="familia">Família</label>
                  <select id="familia" name="familia" className="form-select" defaultValue={familia}>
                    <option value="">Todas</option>
                    {familias.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="col-md-1">
                  <label className="form-check">
                    {/* Invertido de proposito: o padrao e ver tudo, porque quem
                        abre esta tela costuma estar procurando o que desativou. */}
                    <input className="form-check-input" type="checkbox" name="inativos" value="0" defaultChecked={inativos === '0'} />
                    <span className="form-check-label">Só ativos</span>
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
            titulo="Catálogo"
            aoLado={<span className="text-secondary">{contar(total, 'material', 'materiais')}</span>}
            paginacao={
              <PaginacaoCompacta pagina={pagina} porPagina={POR_PAGINA} total={total} base="/materiais" parametros={contexto} />
            }
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/materiais"
                parametros={contexto}
              />
            }
            colunas={
              <>
                <ColunaOrdenavel campo="nome" atual={ordem} base="/materiais" parametros={contexto}>Material</ColunaOrdenavel>
                <ColunaOrdenavel campo="categoria" atual={ordem} base="/materiais" parametros={contexto}>Categoria</ColunaOrdenavel>
                <ColunaOrdenavel campo="custo" atual={ordem} base="/materiais" parametros={contexto} primeiraDirecao="desc" className="text-end">Custo</ColunaOrdenavel>
                <ColunaOrdenavel campo="preco" atual={ordem} base="/materiais" parametros={contexto} primeiraDirecao="desc" className="text-end">Venda</ColunaOrdenavel>
                <th>Origem do preço</th>
                <th>Cobrado</th>
                <th className="w-1 text-end">Ações</th>
              </>
            }
          >
            {materiais.map((m) => (
              <tr key={m.id} className={m.ativo ? '' : 'text-secondary'}>
                <td>
                  <Link href={`/materiais/${m.id}`} className="text-reset fw-medium">{m.nome}</Link>
                  {m.ativo ? null : <Anotacao>inativo</Anotacao>}
                </td>
                <td>
                  {m.categoria === null ? (
                    ''
                  ) : (
                    <Link href={`/materiais?categoria=${encodeURIComponent(m.categoria)}`} className="text-reset">{m.categoria}</Link>
                  )}
                </td>
                <td className="numero">
                  <Link href={`/materiais/${m.id}?foco=custo`} className="text-reset">
                    {m.custo === null ? <span className="text-secondary">—</span> : <Dinheiro valor={m.custo} />}
                  </Link>
                </td>
                <td className="numero">
                  <Link href={`/materiais/${m.id}?foco=preco`} className="text-reset fw-medium">
                    <Dinheiro valor={m.preco} />
                  </Link>
                </td>
                <td>
                  {m.precoTravado ? (
                    <span className="text-secondary" title="A família não mexe neste preço">
                      <IconLock className="icon icon-sm me-1" />travado
                    </span>
                  ) : m.familiaPrecoId === null ? (
                    <span className="text-secondary">digitado</span>
                  ) : m.custo === null ? (
                    <span className="text-secondary" title="Sem custo a família não calcula">sem custo</span>
                  ) : (
                    <Link href={`/precificacao/${m.familiaPrecoId}`}>{m.familiaNome}</Link>
                  )}
                </td>
                <td>{rotuloUnidade(m.unidadeCobranca)}</td>
                <td><AcoesMaterial id={m.id} nome={m.nome} ativo={m.ativo} /></td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
