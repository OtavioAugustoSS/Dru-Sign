import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { Paginacao, POR_PAGINA, lerPagina } from '@/componentes/paginacao'
import { Apelido, Situacao, SituacaoEstado, SituacaoPagamento } from '@/componentes/situacao'
import { contagensDeOrdens, contarOrdens, listarOrdens } from '@/infra/ordens/repositorio'
import { ROTULO_ESTADO, type EstadoPagamento } from '@/domain/ordem/estados'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'

export const metadata: Metadata = { title: 'Ordens' }

const ESTADOS = ['orcamento', 'aberta', 'concluida', 'cancelada'] as const

/**
 * O pagamento na mesma lingua da coluna de situacao: ponto mais palavra.
 *
 * Antes esta coluna era texto colorido, e havia motivo: situacao era selo, e dois
 * selos pastel lado a lado viravam confete. So que, sem o selo, a razao caiu --
 * e o texto colorido tinha virado o novo grito: "Não pago" em vermelho e negrito
 * em quase toda linha, porque ordem aberta normalmente ainda nao foi paga. Agora
 * a cor mora no ponto de 8px e a palavra fica na cor do corpo.
 *
 * O que sobrevive da versao anterior: quando falta dinheiro, o que interessa e
 * QUANTO falta, nao a palavra "parcial".
 */
function Pagamento({ estado, saldo }: { estado: EstadoPagamento; saldo: string }) {
  if (estado === 'parcial') {
    return (
      <Situacao tom="atencao">
        Falta <Dinheiro valor={saldo} />
      </Situacao>
    )
  }
  return <SituacaoPagamento estado={estado} />
}

export default async function PaginaOrdens({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string; pagina?: string }>
}) {
  const usuario = await exigirUsuario()
  const { q = '', estado = '', de = '', ate = '', pagina: paginaCrua } = await searchParams
  const estadoValido = ESTADOS.find((e) => e === estado)
  const pagina = lerPagina(paginaCrua)
  const filtros = { q, estado: estadoValido, de: de || undefined, ate: ate || undefined }

  const [ordens, total, contagens] = await Promise.all([
    listarOrdens(usuario.empresaId, { ...filtros, limite: POR_PAGINA, pagina }),
    contarOrdens(usuario.empresaId, filtros),
    contagensDeOrdens(usuario.empresaId),
  ])
  const filtrando = Boolean(q || estado || de)

  return (
    <>
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Ordens"
        acoes={
          <Link href="/ordens/nova" className="btn btn-primary">
            <IconPlus className="icon" /> Nova ordem
          </Link>
        }
      />
      <CorpoPagina>
        {/* Cada numero e a porta da lista que ele conta. "A receber" nao filtra
            -- o estado de pagamento e derivado, nao coluna -- entao ele informa
            e nao promete clique. E o numero que motivou trocar de sistema:
            R$ 207.795 estavam parados em 513 ordens no legado, e nao apareciam
            em tela nenhuma. */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Em aberto" valor={contagens.aberta} href="/ordens?estado=aberta" nota="na produção agora" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Orçamentos" valor={contagens.orcamento} href="/ordens?estado=orcamento" nota="esperando aprovação" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Finalizadas" valor={contagens.concluida} href="/ordens?estado=concluida" nota="serviço entregue" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador
              rotulo="A receber"
              valor={<Dinheiro valor={contagens.aReceber} />}
              tom={Number(contagens.aReceber) > 0 ? 'atencao' : 'bom'}
              nota="faturado que ainda não entrou"
            />
          </div>
        </div>

        <form method="get" className="card mb-3" role="search">
          <div className="card-body row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label" htmlFor="q">Buscar</label>
              <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou apelido" />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="estado">Situação</label>
              <select id="estado" name="estado" className="form-select" defaultValue={estado}>
                <option value="">Todas</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="de">Aberta de</label>
              <input id="de" type="date" name="de" className="form-control" defaultValue={de} />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="ate">até</label>
              <input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} />
            </div>
            <div className="col-md-2 d-flex gap-2">
              <button type="submit" className="btn btn-primary">Filtrar</button>
              <Link href="/ordens" className="btn">Limpar</Link>
            </div>
          </div>
        </form>

        {ordens.length === 0 ? (
          <EstadoVazio
            titulo={filtrando ? 'Nenhuma ordem com esse filtro' : 'Nenhuma ordem ainda'}
            descricao={
              filtrando
                ? 'A busca olha o número da OS, o nome e o apelido do cliente. O que foi feito até 2026 está no Histórico.'
                : 'A primeira será a nº 18461, continuando a numeração do sistema antigo. As 18.443 anteriores ficam no Histórico.'
            }
            acoes={
              <>
                <Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link>
                <Link href="/historico" className="btn">Ver o histórico</Link>
              </>
            }
          />
        ) : (
          <CartaoTabela
            rotulo="Ordens"
            colunas={
              <>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Situação</th>
                <th>Pagamento</th>
                <th>Aberta em</th>
                <th>Entrega</th>
                <th className="text-end">Preço final</th>
              </>
            }
            rodape={
              <Paginacao
                pagina={pagina}
                porPagina={POR_PAGINA}
                total={total}
                base="/ordens"
                parametros={{ q, estado, de, ate }}
              />
            }
          >
            {ordens.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/ordens/${o.id}`} className="text-reset fw-medium">
                    <NumeroOs numero={o.numero} />
                  </Link>
                </td>
                <td>
                  {/* Tambem link: o nome do cliente e um alvo bem maior que o numero. */}
                  <Link href={`/ordens/${o.id}`} className="text-reset text-decoration-none">
                    {o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}
                  </Link>
                  <Apelido apelido={o.clienteApelido} />
                </td>
                <td><SituacaoEstado estado={o.estadoProducao} /></td>
                <td><Pagamento estado={o.estadoPagamento} saldo={o.saldo} /></td>
                <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
                <td className="numero"><Dinheiro valor={o.precoFinal} /></td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
