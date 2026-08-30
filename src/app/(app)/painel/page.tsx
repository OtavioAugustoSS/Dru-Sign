import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { carregarPainel } from '@/infra/painel/dados'
import { carregarCarteiraComExtras, telefonesDeClientes } from '@/infra/clientes/carteira'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { mesCalendario, formatarDataCalendario } from '@/domain/ordem/datas'
import { ROTULO_ESTADO } from '@/domain/ordem/estados'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { BlocoVazio } from '@/componentes/estado-vazio'
import { AtalhosPeriodo } from '@/componentes/atalhos-periodo'
import { periodosUsuais } from '@/componentes/periodos'
import { BarrasNoTempo, BarrasEmLista, BarrasPareadas, type Fatia } from '@/componentes/graficos'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { contar } from '@/componentes/plural'
import { formatarTelefone } from '@/domain/clientes/telefone'

export const metadata: Metadata = { title: 'Painel' }

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** '2026-08' -> 'ago/26'. Doze rotulos no eixo, entao precisam ser curtos. */
function rotuloDoMes(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${MES_CURTO[Number(m) - 1]}/${(ano as string).slice(2)}`
}

/** O mes inteiro como periodo, para a barra levar ao recorte que ela representa. */
function periodoDoMes(mes: string): { de: string; ate: string } {
  const [ano, m] = mes.split('-').map(Number) as [number, number]
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export default async function PaginaPainel({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; serie?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const agora = new Date()
  const mes = mesCalendario(agora)
  const { de = mes.de, ate = mes.ate, serie } = await searchParams
  const aba = serie === 'arquivo' ? 'arquivo' : 'novo'

  // As duas leituras em paralelo: a carteira varre os 3.220 cadastros e as
  // 18.443 ordens do arquivo, e nao depende em nada do periodo escolhido.
  const [resultado, { carteira }] = await Promise.all([
    (async () => {
      try {
        return { painel: await carregarPainel(usuario.empresaId, { de, ate }), erro: null as string | null }
      } catch (e) {
        if (!(e instanceof ErroDeValidacao)) throw e
        return { painel: await carregarPainel(usuario.empresaId, mes), erro: e.message }
      }
    })(),
    carregarCarteiraComExtras(usuario.empresaId),
  ])
  const { painel, erro } = resultado
  const reativar = carteira.paraReativar.slice(0, 5)
  const telefones = await telefonesDeClientes(usuario.empresaId, reativar.flatMap((g) => g.clienteIds))

  const periodo = `de=${painel.de}&ate=${painel.ate}`
  const contexto = { serie: aba === 'arquivo' ? 'arquivo' : undefined }

  const faturamento: Fatia[] = painel.faturamentoMensal.map((p) => {
    const m = periodoDoMes(p.mes)
    return { rotulo: rotuloDoMes(p.mes), valor: Number(p.valor), href: `/ordens?de=${m.de}&ate=${m.ate}` }
  })
  const arquivo: Fatia[] = painel.arquivoAnual.map((p) => ({
    rotulo: p.mes,
    valor: Number(p.valor),
    href: `/historico?aba=antigo&de=${p.mes}-01-01&ate=${p.mes}-12-31`,
  }))

  const estados: Fatia[] = (['aberta', 'concluida', 'orcamento', 'cancelada'] as const)
    .map((e) => ({
      rotulo: ROTULO_ESTADO[e],
      valor: painel.porEstado[e],
      texto: String(painel.porEstado[e]),
      href: `/ordens?estado=${e}&${periodo}`,
      tom: e === 'aberta' ? ('marca' as const) : e === 'concluida' ? ('bom' as const) : e === 'cancelada' ? ('ruim' as const) : ('neutro' as const),
    }))
    .filter((f) => f.valor > 0)

  return (
    <>
      <CabecalhoPagina
        pretitulo="Visão geral"
        titulo="Painel"
        descricao="Como a loja está indo. Todo número aqui é um link: clique e você cai na tela onde aquele dado mora, já filtrada."
        acoes={<Link href="/" className="btn">Fila de trabalho</Link>}
      />
      <CorpoPagina>
        <form method="get" className="card mb-3">
          <div className="card-body">
            <div className="mb-3">
              <AtalhosPeriodo periodos={periodosUsuais(agora)} de={painel.de} ate={painel.ate} base="/painel" parametros={contexto} />
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="de">De</label>
                <input id="de" type="date" name="de" className="form-control" defaultValue={painel.de} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label" htmlFor="ate">Até</label>
                <input id="ate" type="date" name="ate" className="form-control" defaultValue={painel.ate} />
              </div>
              <div className="col-auto">
                <button type="submit" className="btn btn-primary">Mostrar</button>
              </div>
              {erro ? <div className="col-12 text-danger-emphasis small" role="alert">{erro} Mostrando o mês atual.</div> : null}
            </div>
          </div>
        </form>

        {/* O dinheiro do periodo. Faturado e o que foi vendido; recebido e o que
            entrou no caixa. Os dois divergem, e e essa diferenca que vira "a
            receber" -- foi ela que deixou R$ 207 mil parados no sistema antigo. */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Faturado no período" valor={<Dinheiro valor={painel.faturado} />} href={`/ordens?${periodo}`} testId="faturado" nota={contar(painel.ordensNoPeriodo, 'ordem aberta', 'ordens abertas')} />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Entrou no caixa" valor={<Dinheiro valor={painel.recebido} />} tom="bom" href={`/financeiro?${periodo}&tipo=entrada`} testId="recebido" nota="recebimentos das ordens" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Saiu do caixa" valor={<Dinheiro valor={painel.saidas} />} href={`/financeiro?${periodo}&tipo=saida`} testId="saidas-painel" nota="compras e contas pagas" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador
              rotulo="Saldo do período"
              valor={<Dinheiro valor={painel.saldoCaixa} />}
              tom={Number(painel.saldoCaixa) === 0 ? undefined : Number(painel.saldoCaixa) < 0 ? 'ruim' : 'bom'}
              href={`/financeiro?${periodo}`}
              testId="saldo-painel"
              nota="entradas menos saídas"
            />
          </div>
        </div>

        {/* O que exige acao hoje, e nao no periodo escolhido: dinheiro parado e
            entrega atrasada nao somem porque o filtro nao alcanca a ordem. */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-4">
            <CartaoIndicador
              rotulo="A receber"
              valor={<Dinheiro valor={painel.aReceber} />}
              tom={Number(painel.aReceber) > 0 ? 'atencao' : undefined}
              href="/"
              testId="a-receber"
              nota={`${contar(painel.aCobrar, 'ordem pronta e não paga', 'ordens prontas e não pagas')} · de qualquer data`}
            />
          </div>
          <div className="col-6 col-lg-4">
            <CartaoIndicador
              rotulo="Entregas atrasadas"
              valor={painel.atrasadas}
              tom={painel.atrasadas > 0 ? 'ruim' : 'bom'}
              href="/producao"
              testId="atrasadas"
              nota="prometidas para antes de hoje"
            />
          </div>
          <div className="col-6 col-lg-4">
            <CartaoIndicador
              rotulo="Clientes para reativar"
              valor={carteira.contagem.adormecido}
              tom={carteira.contagem.adormecido > 0 ? 'atencao' : undefined}
              href="/clientes/carteira?situacao=adormecido"
              nota="compraram e sumiram há 6 a 24 meses"
            />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-xl-7">
            <div className="card h-100">
              <div className="card-header">
                <h2 className="card-title">Faturamento mês a mês</h2>
                {/* As duas eras em abas, e nao no mesmo eixo: o sistema novo tem
                    semanas de dados e o arquivo tem 14 anos; juntos, o novo
                    viraria um risco no chao do grafico. */}
                <ul className="nav nav-tabs card-header-tabs ms-auto flex-grow-0" aria-label="Origem dos dados">
                  <li className="nav-item">
                    <Link href={`/painel?${periodo}`} className={aba === 'novo' ? 'nav-link active' : 'nav-link'} aria-current={aba === 'novo' ? 'page' : undefined}>
                      Sistema novo
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link href={`/painel?${periodo}&serie=arquivo`} className={aba === 'arquivo' ? 'nav-link active' : 'nav-link'} aria-current={aba === 'arquivo' ? 'page' : undefined}>
                      Arquivo antigo
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="card-body">
                {aba === 'novo' ? (
                  faturamento.some((f) => f.valor > 0) ? (
                    <>
                      <BarrasNoTempo fatias={faturamento} rotulo="Faturamento dos últimos doze meses" />
                      <p className="text-secondary small mt-2 mb-0">Cada barra abre as ordens daquele mês.</p>
                    </>
                  ) : (
                    <BlocoVazio
                      titulo="Nenhuma venda ainda neste sistema"
                      descricao="As barras aparecem quando a primeira ordem for aberta. Enquanto isso, os 14 anos de venda estão na aba do arquivo antigo."
                    />
                  )
                ) : (
                  <>
                    <BarrasNoTempo fatias={arquivo} rotulo="Faturamento por ano no sistema antigo" />
                    <p className="text-secondary small mt-2 mb-0">
                      Ano a ano, de 2012 a 2026, do sistema antigo. Cada barra abre o histórico daquele ano.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-5">
            <div className="card h-100">
              <div className="card-header"><h2 className="card-title">Entrou e saiu, mês a mês</h2></div>
              <div className="card-body">
                {painel.caixaMensal.some((m) => Number(m.entrada) > 0 || Number(m.saida) > 0) ? (
                  <BarrasPareadas
                    rotulo="Entradas e saídas dos últimos doze meses"
                    meses={painel.caixaMensal.map((m) => {
                      const p = periodoDoMes(m.mes)
                      return {
                        rotulo: rotuloDoMes(m.mes),
                        entrada: Number(m.entrada),
                        saida: Number(m.saida),
                        href: `/financeiro?de=${p.de}&ate=${p.ate}`,
                      }
                    })}
                  />
                ) : (
                  <BlocoVazio
                    titulo="O caixa ainda não tem movimento"
                    descricao="As entradas nascem quando você recebe uma ordem; as saídas, quando você lança uma despesa."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-xl-4">
            <div className="card h-100">
              <div className="card-header"><h2 className="card-title">Ordens do período</h2></div>
              <div className="card-body">
                {estados.length > 0 ? (
                  <BarrasEmLista fatias={estados} rotulo="Ordens por situação no período" />
                ) : (
                  <BlocoVazio titulo="Nenhuma ordem no período" descricao="Escolha um período maior nos atalhos acima." />
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card h-100">
              <div className="card-header"><h2 className="card-title">Quem mais comprou</h2></div>
              <div className="card-body">
                {painel.melhoresClientes.length > 0 ? (
                  <BarrasEmLista
                    rotulo="Clientes que mais compraram no período"
                    fatias={painel.melhoresClientes.map((c) => ({
                      rotulo: c.nome,
                      valor: Number(c.valor),
                      href: c.id ? `/clientes/${c.id}` : undefined,
                    }))}
                  />
                ) : (
                  <BlocoVazio
                    titulo="Nenhuma venda com cliente no período"
                    descricao="Venda de balcão não entra aqui: ela não tem nome. Escolha o cliente na ordem para ele aparecer."
                  />
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="card h-100">
              <div className="card-header"><h2 className="card-title">Por onde o dinheiro saiu</h2></div>
              <div className="card-body">
                {painel.despesasPorConta.length > 0 ? (
                  <BarrasEmLista
                    rotulo="Despesas por conta no período"
                    fatias={painel.despesasPorConta.map((d) => ({
                      rotulo: d.nome,
                      valor: Number(d.valor),
                      tom: 'ruim' as const,
                      href: d.id ? `/financeiro?${periodo}&conta=${d.id}` : undefined,
                    }))}
                  />
                ) : (
                  <BlocoVazio
                    titulo="Nenhuma saída no período"
                    descricao="As compras e contas que você lança no livro-caixa aparecem aqui, agrupadas pela conta do plano."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <CartaoTabela
          rotulo="Clientes para reativar"
          titulo="Para ligar esta semana"
          aoLado={
            <Link href="/clientes/carteira?situacao=adormecido" className="text-secondary">
              ver os {carteira.contagem.adormecido}
            </Link>
          }
          vazio={
            reativar.length === 0 ? (
              <BlocoVazio titulo="Ninguém para reativar" descricao="Nenhum cliente está entre 6 e 24 meses sem comprar." />
            ) : null
          }
          colunas={
            <>
              <th>Cliente</th>
              <th style={{ width: '13rem' }}>Telefone</th>
              <th style={{ width: '10rem' }}>Última compra</th>
              <th className="text-end" style={{ width: '10rem' }}>Já faturou</th>
            </>
          }
        >
          {reativar.map((g) => {
            const numeros = [...new Set(g.clienteIds.flatMap((id) => telefones.get(id) ?? []))].slice(0, 1)
            return (
              <tr key={g.documento ?? g.clienteIds[0]}>
                <td>
                  {g.clienteIds.length === 1 && g.clienteIds[0] ? (
                    <Link href={`/clientes/${g.clienteIds[0]}`} className="text-reset fw-medium">{g.nome}</Link>
                  ) : (
                    <Link href={`/clientes?q=${g.documento ?? ''}`} className="text-reset fw-medium">{g.nome}</Link>
                  )}
                </td>
                <td className="text-secondary">{numeros[0] ? formatarTelefone(numeros[0]) : <span className="anotacao-solta">sem telefone</span>}</td>
                <td className="text-secondary">{formatarDataCalendario(new Date(g.ultimaOrdemEm))}</td>
                <td className="numero">{valorEmReais(g.faturado)}</td>
              </tr>
            )
          })}
        </CartaoTabela>
      </CorpoPagina>
    </>
  )
}
