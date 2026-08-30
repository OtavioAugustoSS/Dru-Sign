import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { limparTextoLegado } from '@/componentes/texto-legado'
import { buscarHistorico } from '@/infra/legado/consulta'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarDataCalendario } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Histórico' }

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; de?: string; ate?: string; pagina?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', de = '', ate = '', pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)

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

  return (
    <>
      <CabecalhoPagina
        pretitulo="Arquivo"
        titulo="Histórico do sistema antigo"
        descricao="Somente leitura. É o que a loja fez de 2012 a 2026, com o texto como foi escrito — só sem as linhas que o sistema antigo usava para marcar campo vazio."
      />
      <CorpoPagina>
        <form method="get" className="card mb-3" role="search">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label" htmlFor="q">Buscar</label>
              <div className="input-icon">
                <span className="input-icon-addon"><IconSearch className="icon" /></span>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou o que estava escrito" autoFocus />
              </div>
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="de">De</label>
              <input id="de" type="date" name="de" className="form-control" defaultValue={de} />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="ate">Até</label>
              <input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary">Buscar</button>
              <Link href="/historico" className="btn">Limpar</Link>
            </div>
            {erro ? (
              <div className="col-12 text-danger-emphasis small" role="alert">
                {erro} Mostrando sem filtro de data.
              </div>
            ) : null}
          </div>
        </form>

        {historico.linhas.length === 0 ? (
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
                parametros={{ q, de, ate }}
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
