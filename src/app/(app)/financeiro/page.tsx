import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarLivro } from '@/infra/caixa/livro'
import { listarContas } from '@/infra/caixa/plano'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarDataCalendario, mesCalendario } from '@/domain/ordem/datas'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { SituacaoTipoLancamento } from '@/componentes/situacao'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { Paginacao, PaginacaoCompacta, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { contar } from '@/componentes/plural'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { AtalhosPeriodo } from '@/componentes/atalhos-periodo'
import { periodosUsuais } from '@/componentes/periodos'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { BotaoEstorno } from './botao-estorno'

export const metadata: Metadata = { title: 'Financeiro' }

const TIPOS = [
  { valor: '', rotulo: 'Entradas e saídas' },
  { valor: 'entrada', rotulo: 'Só entradas' },
  { valor: 'saida', rotulo: 'Só saídas' },
]

export default async function PaginaFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; pagina?: string; tipo?: string; conta?: string; q?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const agora = new Date()
  const mes = mesCalendario(agora)
  const { de = mes.de, ate = mes.ate, pagina: paginaCrua, tipo: tipoCru, conta = '', q = '' } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const tipo = tipoCru === 'entrada' || tipoCru === 'saida' ? tipoCru : ''
  const filtros = { limite: POR_PAGINA, pagina, ordem: 'desc' as const, tipo, contaId: conta, q }

  const [contas, resultado] = await Promise.all([
    listarContas(usuario.empresaId, { incluirInativas: true }),
    (async () => {
      try {
        return { livro: await listarLivro(usuario.empresaId, { de, ate }, filtros), erro: null as string | null }
      } catch (e) {
        if (!(e instanceof ErroDeValidacao)) throw e
        return { livro: await listarLivro(usuario.empresaId, mes, filtros), erro: e.message }
      }
    })(),
  ])
  const { livro, erro } = resultado

  const periodos = periodosUsuais(agora)
  // O periodo NAO entra aqui: os atalhos e que o definem, e o resto do filtro
  // e que precisa sobreviver a troca de periodo.
  const contexto = { tipo: tipo || undefined, conta: conta || undefined, q: q || undefined }
  const contextoComPeriodo = { ...contexto, de: livro.de, ate: livro.ate }
  const filtrando = tipo !== '' || conta !== '' || q !== ''

  return (
    <>
      <CabecalhoPagina
        pretitulo="Financeiro"
        titulo="Livro-caixa"
        descricao="O extrato do caixa: tudo o que entrou e tudo o que saiu, dia a dia. As entradas você não digita — elas nascem sozinhas quando você recebe uma ordem de serviço. As saídas são as compras e contas que você lança aqui."
        acoes={
          <>
            <Link href="/financeiro/contador" className="btn">
              Relatório do contador
            </Link>
            <Link href="/financeiro/saida" className="btn btn-primary">
              <IconPlus className="icon" /> Nova saída
            </Link>
          </>
        }
      />
      <CorpoPagina>
        <form method="get" className="card mb-3">
          <div className="card-body">
            {/* Os atalhos primeiro: "mes passado" e a pergunta mais comum do
                caixa, e digitar duas datas para isso e trabalho toda vez. */}
            <div className="mb-3">
              <AtalhosPeriodo periodos={periodos} de={livro.de} ate={livro.ate} base="/financeiro" parametros={contexto} />
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="de">De</label>
                <input id="de" type="date" name="de" className="form-control" defaultValue={livro.de} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="ate">Até</label>
                <input id="ate" type="date" name="ate" className="form-control" defaultValue={livro.ate} />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="tipo">Tipo</label>
                <select id="tipo" name="tipo" className="form-select" defaultValue={tipo}>
                  {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="conta">Conta</label>
                <select id="conta" name="conta" className="form-select" defaultValue={conta}>
                  <option value="">Todas as contas</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>{c.codigo} · {c.nome}{c.ativa ? '' : ' (desativada)'}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="q">Buscar</label>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Histórico ou fornecedor" />
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button type="submit" className="btn btn-primary">Mostrar</button>
                {filtrando ? <Link href={`/financeiro?de=${livro.de}&ate=${livro.ate}`} className="btn">Limpar</Link> : null}
              </div>
              {erro ? <div className="col-12 text-danger-emphasis small" role="alert">{erro} Mostrando o mês atual.</div> : null}
            </div>
          </div>
        </form>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            {/* Cada cartao filtra a lista pelo que ele soma: clicar em "Saídas"
                deixa so as saidas na tabela abaixo. */}
            <CartaoIndicador
              rotulo="Entradas"
              valor={<Dinheiro valor={livro.entradas} />}
              href={`/financeiro?de=${livro.de}&ate=${livro.ate}&tipo=entrada`}
              testId="entradas"
              nota="Recebimentos das ordens no período"
            />
          </div>
          <div className="col-md-4">
            <CartaoIndicador
              rotulo="Saídas"
              valor={<Dinheiro valor={livro.saidas} />}
              href={`/financeiro?de=${livro.de}&ate=${livro.ate}&tipo=saida`}
              testId="saidas"
              nota="O que foi lançado como despesa"
            />
          </div>
          <div className="col-md-4">
            {/* O saldo e o unico dos tres que quer dizer bom ou ruim. */}
            <CartaoIndicador
              rotulo="Saldo do período"
              valor={<Dinheiro valor={livro.saldo} />}
              /* Zero nao e bom nem ruim: mes sem movimento pintado de verde
                 diz "esta tudo certo" sobre um caixa que nao andou. */
              tom={Number(livro.saldo) === 0 ? undefined : Number(livro.saldo) < 0 ? 'ruim' : 'bom'}
              testId="saldo-periodo"
              nota="Entradas menos saídas"
            />
          </div>
        </div>

        {livro.linhas.length === 0 ? (
          <EstadoVazio
            titulo={filtrando ? 'Nenhum lançamento com esse filtro' : 'Nenhum lançamento no período'}
            descricao={
              filtrando
                ? 'Tente um período maior, outra conta, ou limpe o filtro.'
                : 'Entradas nascem dos recebimentos, na ordem. Saídas você lança aqui.'
            }
            acoes={
              <>
                <Link href="/financeiro/saida" className="btn btn-primary">Nova saída</Link>
                {filtrando ? <Link href={`/financeiro?de=${livro.de}&ate=${livro.ate}`} className="btn">Limpar o filtro</Link> : null}
              </>
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Lançamentos"
            titulo="Lançamentos"
            aoLado={<span className="text-secondary">{contar(livro.total, 'lançamento', 'lançamentos')} no período</span>}
            paginacao={
              <PaginacaoCompacta pagina={pagina} porPagina={POR_PAGINA} total={livro.total} base="/financeiro" parametros={contextoComPeriodo} />
            }
            rodape={
              <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={livro.total} base="/financeiro" parametros={contextoComPeriodo} />
            }
            colunas={
              <>
                <th style={{ width: '8rem' }}>Data</th>
                <th style={{ width: '8rem' }}>Tipo</th>
                <th>Histórico</th>
                <th style={{ width: '16rem' }}>Conta</th>
                <th style={{ width: '10rem' }}>Quem</th>
                <th className="text-end" style={{ width: '10rem' }}>Valor</th>
                <th style={{ width: '12rem' }}></th>
              </>
            }
          >
            {livro.linhas.map((l) => (
              <tr key={l.id} className={l.estornadoEm ? 'text-secondary' : ''}>
                <td>{formatarDataCalendario(new Date(l.data))}</td>
                <td><SituacaoTipoLancamento tipo={l.tipo} /></td>
                <td>
                  {l.ordemId ? <Link href={`/ordens/${l.ordemId}?de=financeiro`} className="text-reset">{l.historico}</Link> : l.historico}
                  {l.fornecedor ? <div className="small text-secondary">{l.fornecedor}</div> : null}
                  {l.parcela ? <div className="small text-secondary">parcela {l.parcela}/{l.totalParcelas}</div> : null}
                  {l.estornadoEm ? <div className="small">estornado · {l.motivoEstorno}</div> : null}
                </td>
                <td className="text-secondary">{l.contaCodigo} · {l.contaNome}</td>
                <td className="text-secondary">{l.usuarioNome}</td>
                <td className={`numero ${l.estornadoEm ? 'text-decoration-line-through' : ''}`}>
                  {l.tipo === 'saida' ? '−' : ''}
                  {valorEmReais(l.valor)}
                </td>
                {/* A saida se desfaz aqui; a entrada NAO. Ela nasce do
                    recebimento e some junto com ele, na ordem -- senao o caixa
                    diria uma coisa e a ordem outra. Antes esta celula ficava
                    vazia na linha de entrada, e quem queria desfazer nao tinha
                    para onde ir. */}
                <td className="text-end">
                  {l.tipo === 'saida' && !l.estornadoEm ? <BotaoEstorno lancamentoId={l.id} /> : null}
                  {l.tipo === 'entrada' && !l.estornadoEm && l.ordemId ? (
                    <Link href={`/ordens/${l.ordemId}?de=financeiro`} className="btn btn-sm btn-ghost-secondary">Desfazer na ordem</Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
