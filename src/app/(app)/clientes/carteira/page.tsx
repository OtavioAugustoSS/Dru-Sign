import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Paginacao, PaginacaoCompacta, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { contar } from '@/componentes/plural'
import { Percentual } from '@/componentes/percentual'
import { Anotacao, Apelido, SituacaoRecencia } from '@/componentes/situacao'
import { carregarCarteiraComExtras, telefonesDeClientes } from '@/infra/clientes/carteira'
import { formatarDocumento } from '@/domain/clientes/documento'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { GrupoCarteira } from '@/domain/clientes/carteira'
import { aplicar, cidadeDo, estaFiltrando, fatiaDoRecorte, lerFiltros, parametrosDe, MINIMOS, ORDENS, SITUACOES } from './filtros'

export const metadata: Metadata = { title: 'Carteira de clientes' }

function Nome({ g, arquivado }: { g: GrupoCarteira; arquivado: boolean }) {
  const destino = g.clienteIds.length === 1 && g.clienteIds[0]
    ? `/clientes/${g.clienteIds[0]}`
    : g.documento
      ? `/clientes?q=${g.documento}`
      : null
  return (
    <>
      {destino ? (
        <Link href={destino} className="text-reset fw-medium">{g.nome}</Link>
      ) : (
        <span className="fw-medium">{g.nome}</span>
      )}
      <Apelido apelido={g.apelido} />
      {arquivado ? <Anotacao>arquivado</Anotacao> : null}
      {g.cadastros > 1 ? <div className="small text-secondary">{g.cadastros} cadastros com o mesmo documento</div> : null}
      {g.documento ? <div className="small text-secondary">{formatarDocumento(g.documento)}</div> : null}
    </>
  )
}

export default async function PaginaCarteira({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirPapel('administracao')
  const params = await searchParams
  const pagina = lerPagina(params.pagina)
  const f = lerFiltros(params)

  const { carteira, cidades, arquivados } = await carregarCarteiraComExtras(usuario.empresaId)

  const recorte = aplicar(carteira.grupos, f, { cidades, arquivados })
  const naPagina = recorte.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const { soma, pct } = fatiaDoRecorte(recorte, carteira.faturadoTotal)
  const telefones = await telefonesDeClientes(usuario.empresaId, naPagina.flatMap((g) => g.clienteIds))

  // As cidades que existem na carteira, e nao as do cadastro inteiro: filtro
  // que oferece opcao sem resultado faz a pessoa perder tempo.
  const cidadesDaCarteira = [...new Set(carteira.grupos.map((g) => cidadeDo(g, cidades)).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const contexto = parametrosDe(f)

  return (
    <>
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Carteira de clientes"
        descricao="Quem sumiu e vale a pena ligar, e quem carrega o faturamento da loja. Conta os 14 anos inteiros: as ordens do sistema antigo e as daqui."
        acoes={<Link href="/clientes" className="btn">Todos os cadastros</Link>}
      />
      <CorpoPagina>
        {carteira.grupos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum cliente comprou ainda"
            descricao="A carteira nasce das ordens, do sistema antigo e deste. Venda de balcão não entra: ela não tem nome."
          />
        ) : (
          <>
            {/* Cada cartao e tambem a porta do recorte que ele conta: clicar em
                "Adormecidos" filtra a lista para eles. Numero que so informa
                obriga a pessoa a descobrir sozinha como chegar la. */}
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Faturado" valor={<Dinheiro valor={carteira.faturadoTotal} />} href="/clientes/carteira" testId="faturado-total" nota="tudo o que estes clientes já compraram, desde 2012" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Ativos" valor={carteira.contagem.ativo} tom="bom" href="/clientes/carteira?situacao=ativo" nota="compraram nos últimos 6 meses" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Adormecidos" valor={carteira.contagem.adormecido} tom="atencao" href="/clientes/carteira?situacao=adormecido" testId="adormecidos" nota="de 6 a 24 meses — é a lista de reativação" />
              </div>
              <div className="col-6 col-lg-3">
                <CartaoIndicador rotulo="Perdidos" valor={carteira.contagem.perdido} href="/clientes/carteira?situacao=perdido" nota="mais de 2 anos sem comprar" />
              </div>
            </div>

            <form method="get" className="card mb-3" role="search">
              <div className="card-body row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="q">Buscar</label>
                  <input id="q" type="search" name="q" className="form-control" defaultValue={f.q} placeholder="Nome, apelido ou CPF/CNPJ" />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="situacao">Situação</label>
                  <select id="situacao" name="situacao" className="form-select" defaultValue={f.situacao}>
                    {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label" htmlFor="minimo">Já faturou</label>
                  <select id="minimo" name="minimo" className="form-select" defaultValue={f.minimo}>
                    {MINIMOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label" htmlFor="cidade">Cidade</label>
                  <select id="cidade" name="cidade" className="form-select" defaultValue={f.cidade}>
                    <option value="">Todas</option>
                    {cidadesDaCarteira.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label" htmlFor="de">Última compra de</label>
                  <input id="de" type="date" name="de" className="form-control" defaultValue={f.de} />
                </div>
                <div className="col-md-2">
                  <label className="form-label" htmlFor="ate">até</label>
                  <input id="ate" type="date" name="ate" className="form-control" defaultValue={f.ate} />
                </div>
                <div className="col-md-3">
                  <label className="form-label" htmlFor="ordem">Ordenar por</label>
                  <select id="ordem" name="ordem" className="form-select" defaultValue={f.ordem}>
                    {ORDENS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-check">
                    {/* Valor '0' porque incluir e o padrao: o cadastro que o
                        sistema antigo deu como apagado continua sendo cliente. */}
                    <input className="form-check-input" type="checkbox" name="arquivados" value="0" defaultChecked={!f.incluirArquivados} />
                    <span className="form-check-label">Esconder cadastros arquivados</span>
                  </label>
                </div>
                <div className="col-md-2 d-flex gap-2">
                  <button type="submit" className="btn btn-primary">Filtrar</button>
                  <Link href="/clientes/carteira" className="btn">Limpar</Link>
                </div>
              </div>
            </form>

            <CartaoTabela
              rotulo="Carteira de clientes"
              titulo={f.situacao === 'adormecido' ? 'Para reativar' : 'Clientes'}
              /* A soma do RECORTE, e nao a da carteira inteira: filtrar por
                 "acima de R$ 20.000" e querer saber quanto esse grupo pesa. */
              aoLado={
                <span className="text-secondary">
                  {contar(recorte.length, 'cliente', 'clientes')} · {valorEmReais(soma)} · <Percentual valor={pct} /> do faturamento
                </span>
              }
              paginacao={<PaginacaoCompacta pagina={pagina} porPagina={POR_PAGINA} total={recorte.length} base="/clientes/carteira" parametros={contexto} />}
              rodape={<Paginacao pagina={pagina} porPagina={POR_PAGINA} total={recorte.length} base="/clientes/carteira" parametros={contexto} />}
              vazio={
                recorte.length === 0 ? (
                  <EstadoVazio
                    titulo="Nenhum cliente com esse filtro"
                    descricao="Tente uma situação mais ampla, um valor menor, ou limpe o filtro."
                    acoes={<Link href="/clientes/carteira" className="btn btn-primary">Limpar o filtro</Link>}
                  />
                ) : null
              }
              colunas={
                <>
                  <th>Cliente</th>
                  <th style={{ width: '13rem' }}>Telefone</th>
                  <th style={{ width: '9rem' }}>Cidade</th>
                  <th style={{ width: '9rem' }}>Situação</th>
                  <th style={{ width: '10rem' }}>Última compra</th>
                  <th className="text-end" style={{ width: '6rem' }}>Ordens</th>
                  <th className="text-end" style={{ width: '10rem' }}>Já faturou</th>
                  <th className="text-end" style={{ width: '6rem' }}>Fatia</th>
                </>
              }
            >
              {naPagina.map((g) => {
                // Do grupo inteiro, sem repetir: cinco cadastros da mesma
                // fazenda costumam ter o mesmo numero.
                const numeros = [...new Set(g.clienteIds.flatMap((id) => telefones.get(id) ?? []))].slice(0, 2)
                return (
                  <tr key={g.documento ?? g.clienteIds[0]}>
                    <td><Nome g={g} arquivado={g.clienteIds.every((id) => arquivados.has(id))} /></td>
                    <td className="text-secondary">
                      {numeros.length === 0
                        ? <span className="anotacao-solta">sem telefone no cadastro</span>
                        : numeros.map((n) => <div key={n}>{formatarTelefone(n)}</div>)}
                    </td>
                    <td className="text-secondary">{cidadeDo(g, cidades) ?? ''}</td>
                    <td><SituacaoRecencia recencia={g.recencia} /></td>
                    <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                    <td className="numero">{g.ordens}</td>
                    <td className="numero"><Dinheiro valor={g.faturado} /></td>
                    <td className="numero"><Percentual valor={g.fatiaPct} /></td>
                  </tr>
                )
              })}
            </CartaoTabela>

            {estaFiltrando(f) ? null : (
              <p className="text-secondary mt-3 mb-0">
                Sem filtro, a lista vem do maior faturamento para o menor: as primeiras linhas já são a
                concentração da loja. Para a lista de telefonemas, clique em <strong>Adormecidos</strong>.
              </p>
            )}
          </>
        )}
      </CorpoPagina>
    </>
  )
}
