import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Abas } from '@/componentes/abas'
import { SituacaoEstado } from '@/componentes/situacao'
import { contarOrdens, listarOrdens } from '@/infra/ordens/repositorio'
import { formatarDataHora } from '@/domain/ordem/datas'
import { limparTextoLegado } from '@/componentes/texto-legado'
import { buscarHistorico, contagensDoHistorico } from '@/infra/legado/consulta'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarDataCalendario } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Histórico' }

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; de?: string; ate?: string; pagina?: string; aba?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', de = '', ate = '', pagina: paginaCrua, aba: abaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  const aba = abaCrua === 'novo' ? 'novo' : 'antigo'

  let erro: string | null = null
  let historico
  try {
    historico = await buscarHistorico(usuario.empresaId, { q, de: de || undefined, ate: ate || undefined, limite: POR_PAGINA, pagina })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    historico = await buscarHistorico(usuario.empresaId, { q, limite: POR_PAGINA, pagina })
  }
  const filtrando = Boolean(q || de)

  /*
   * A aba nova mostra o que o sistema NOVO ja entregou. Ela nao repete a tela de
   * Ordens: la esta o trabalho em andamento, aqui esta o que ja saiu -- e o
   * arquivo da loja passa a ser um lugar so, com as duas eras separadas em vez de
   * misturadas.
   */
  const [contagens, novasTotal, novas] = await Promise.all([
    contagensDoHistorico(usuario.empresaId),
    contarOrdens(usuario.empresaId, { estado: 'concluida', q }),
    aba === 'novo'
      ? listarOrdens(usuario.empresaId, { estado: 'concluida', q, limite: POR_PAGINA, pagina })
      : Promise.resolve([]),
  ])

  return (
    <>
      <CabecalhoPagina
        pretitulo="Arquivo"
        titulo="Histórico"
        descricao="Tudo o que a loja já entregou, com as duas eras separadas: o arquivo do sistema antigo, somente leitura, e o que foi feito daqui em diante."
      />
      <CorpoPagina>
        <Abas
          rotulo="Era do histórico"
          base="/historico"
          atual={aba}
          parametros={{ q, de, ate }}
          abas={[
            { valor: 'antigo', rotulo: 'Sistema antigo', contagem: contagens.ordens },
            { valor: 'novo', rotulo: 'Sistema novo', contagem: novasTotal },
          ]}
        />

        {/* Sao 18.443 ordens de catorze anos, e a tela nao dizia isso em lugar
            nenhum: quem abria via cem linhas sem saber se o arquivo tinha cem ou
            vinte mil. Nenhum deles e clicavel -- o arquivo inteiro JA e o que a
            tela mostra sem filtro, entao o clique nao levaria a lugar nenhum. */}
        {aba === 'antigo' ? (
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-4">
            <CartaoIndicador rotulo="Ordens no arquivo" valor={contagens.ordens.toLocaleString('pt-BR')} nota="somente leitura" />
          </div>
          <div className="col-6 col-lg-4">
            <CartaoIndicador rotulo="Faturado no período" valor={<Dinheiro valor={contagens.faturado} />} nota="tudo o que o sistema antigo registrou" />
          </div>
          <div className="col-6 col-lg-4">
            <CartaoIndicador
              rotulo="Vai de"
              valor={contagens.primeiroAno && contagens.ultimoAno ? `${contagens.primeiroAno} a ${contagens.ultimoAno}` : '—'}
              nota="da primeira à última ordem"
            />
          </div>
        </div>
        ) : null}

        <form method="get" className="card mb-3" role="search">
          {/* Sem isto, buscar dentro da aba nova devolve a antiga: o formulario
              monta o endereco do zero e perderia a aba escolhida. */}
          <input type="hidden" name="aba" value={aba} />
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="q">Buscar</label>
              <div className="input-icon">
                <span className="input-icon-addon"><IconSearch className="icon" /></span>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou o que estava escrito" autoFocus />
              </div>
            </div>
            {aba === 'antigo' ? (
              <>
                <div className="col-md-2">
                  <label className="form-label" htmlFor="de">De</label>
                  <input id="de" type="date" name="de" className="form-control" defaultValue={de} />
                </div>
                <div className="col-md-2">
                  <label className="form-label" htmlFor="ate">Até</label>
                  <input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} />
                </div>
              </>
            ) : null}
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary">Buscar</button>
              <Link href={`/historico?aba=${aba}`} className="btn">Limpar</Link>
            </div>
            {erro ? (
              <div className="col-12 text-danger-emphasis small" role="alert">
                {erro} Mostrando sem filtro de data.
              </div>
            ) : null}
          </div>
        </form>

        {aba === 'novo' ? (
          novas.length === 0 ? (
            <EstadoVazio
              titulo={q ? 'Nenhuma ordem entregue com esse filtro' : 'Nada entregue ainda pelo sistema novo'}
              descricao={
                q
                  ? 'A busca olha o número da OS e o nome do cliente.'
                  : 'Quando uma ordem for finalizada, ela aparece aqui. O que a loja fez até 2026 está na outra aba.'
              }
              acoes={<Link href="/historico?aba=antigo" className="btn">Ver o sistema antigo</Link>}
            />
          ) : (
            <CartaoTabela
              rotulo="Ordens entregues pelo sistema novo"
              titulo={`${novasTotal.toLocaleString('pt-BR')} entregues`}
              colunas={
                <>
                  <th className="w-1">Nº</th>
                  <th>Cliente</th>
                  <th>Situação</th>
                  <th>Aberta em</th>
                  <th className="text-end">Total</th>
                </>
              }
              rodape={
                <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={novasTotal} base="/historico" parametros={{ q, aba }} />
              }
            >
              {novas.map((o) => (
                <tr key={o.id}>
                  <td className="numero">
                    <Link href={`/ordens/${o.id}`} className="text-reset"><NumeroOs numero={o.numero} /></Link>
                  </td>
                  <td>{o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}</td>
                  <td><SituacaoEstado estado={o.estadoProducao} /></td>
                  <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                  <td className="numero"><Dinheiro valor={o.precoFinal} /></td>
                </tr>
              ))}
            </CartaoTabela>
          )
        ) : historico.linhas.length === 0 ? (
          <EstadoVazio
            titulo={filtrando ? 'Nada no arquivo com esse filtro' : 'O arquivo está vazio'}
            descricao={
              filtrando
                ? 'A busca olha o número, o nome do cliente e o texto da ordem. Tente um pedaço menor.'
                : 'As 18.443 ordens do sistema antigo ainda não foram importadas. Enquanto isso, só existe aqui o que foi feito no sistema novo.'
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Ordens do sistema antigo"
            titulo={`${historico.encontradas.toLocaleString('pt-BR')} ordens no arquivo`}
            aoLado={
              <span className="numero fw-bold" data-testid="soma-historico">
                <Dinheiro valor={historico.somaTotal} />
              </span>
            }
            colunas={
              <>
                <th>Nº</th>
                <th>Entrada</th>
                <th>Cliente</th>
                <th>O que foi feito</th>
                <th className="text-end">Total</th>
              </>
            }
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={historico.encontradas}
                base="/historico"
                parametros={{ q, de, ate, aba }}
              />
            }
          >
            {historico.linhas.map((l) => (
              <tr key={l.id}>
                <td className="numero"><NumeroOs numero={l.numero} /></td>
                <td className="text-secondary">
                  {formatarDataCalendario(new Date(l.dataEntrada))}
                  {l.dataSaida ? (
                    <div className="small">
                      saiu {formatarDataCalendario(new Date(l.dataSaida))}
                      {l.dataSaidaSuspeita ? ' ⚠' : ''}
                    </div>
                  ) : null}
                  {l.dataSaidaTexto ? <div className="small text-danger-emphasis">saída ilegível: {l.dataSaidaTexto}</div> : null}
                </td>
                <td>
                  {l.clienteId ? <Link href={`/clientes/${l.clienteId}`} className="text-reset">{l.clienteNome}</Link> : l.clienteNome}
                  {l.nomeDestruido ? <div className="small text-secondary">o sistema antigo apagou o nome ao cancelar</div> : null}
                </td>
                <td>
                  <div className="texto-original">{limparTextoLegado(l.texto)}</div>
                  {l.situacao ? <div className="small text-secondary">{l.situacao}</div> : null}
                </td>
                <td className="numero"><Dinheiro valor={l.total} /></td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
