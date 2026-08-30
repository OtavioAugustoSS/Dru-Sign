import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarLivro } from '@/infra/caixa/livro'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarDataCalendario, mesCalendario } from '@/domain/ordem/datas'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { SituacaoTipoLancamento } from '@/componentes/situacao'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { contar } from '@/componentes/plural'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { FiltroPeriodo } from '@/componentes/filtro-periodo'
import { Dinheiro, valorEmReais } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { BotaoEstorno } from './botao-estorno'

export const metadata: Metadata = { title: 'Financeiro' }

export default async function PaginaFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; pagina?: string }>
}) {
  const usuario = await exigirPapel('administracao')
  const mes = mesCalendario(new Date())
  const { de = mes.de, ate = mes.ate, pagina: paginaCrua } = await searchParams
  const pagina = lerPagina(paginaCrua)
  let livro
  let erro: string | null = null
  try {
    livro = await listarLivro(usuario.empresaId, { de, ate }, { limite: POR_PAGINA, pagina })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    livro = await listarLivro(usuario.empresaId, mes, { limite: POR_PAGINA, pagina })
  }

  return (
    <>
      <CabecalhoPagina
        pretitulo="Financeiro"
        titulo="Livro-caixa"
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
        <FiltroPeriodo de={livro.de} ate={livro.ate} erro={erro ? `${erro} Mostrando o mês atual.` : null} />

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <CartaoIndicador rotulo="Entradas" valor={<Dinheiro valor={livro.entradas} />} testId="entradas" nota="Recebimentos das ordens no período" />
          </div>
          <div className="col-md-4">
            <CartaoIndicador rotulo="Saídas" valor={<Dinheiro valor={livro.saidas} />} testId="saidas" nota="O que foi lançado como despesa" />
          </div>
          <div className="col-md-4">
            {/* O saldo e o unico dos tres que quer dizer bom ou ruim. */}
            <CartaoIndicador
              rotulo="Saldo do período"
              valor={<Dinheiro valor={livro.saldo} />}
              tom={Number(livro.saldo) < 0 ? 'ruim' : 'bom'}
              testId="saldo-periodo"
              nota="Entradas menos saídas"
            />
          </div>
        </div>

        {livro.linhas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum lançamento no período"
            descricao="Entradas nascem dos recebimentos, na ordem. Saídas você lança aqui."
            acoes={
              <Link href="/financeiro/saida" className="btn btn-primary">
                Nova saída
              </Link>
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Lançamentos"
            aoLado={<span className="text-secondary">{contar(livro.total, 'lançamento', 'lançamentos')} no período</span>}
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={livro.total}
                base="/financeiro"
                parametros={{ de: livro.de, ate: livro.ate }}
              />
            }
            colunas={
              <>
                <th>Data</th>
                <th>Tipo</th>
                <th>Histórico</th>
                <th>Conta</th>
                <th>Quem</th>
                <th className="text-end">Valor</th>
                <th className="w-1"></th>
              </>
            }
          >
            {livro.linhas.map((l) => (
              <tr key={l.id} className={l.estornadoEm ? 'text-secondary' : ''}>
                <td>{formatarDataCalendario(new Date(l.data))}</td>
                <td><SituacaoTipoLancamento tipo={l.tipo} /></td>
                <td>
                  {l.ordemId ? <Link href={`/ordens/${l.ordemId}`} className="text-reset">{l.historico}</Link> : l.historico}
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
                <td>{l.tipo === 'saida' && !l.estornadoEm ? <BotaoEstorno lancamentoId={l.id} /> : l.ordemNumero ? <span className="small text-secondary">OS <NumeroOs numero={l.ordemNumero} /></span> : null}</td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
