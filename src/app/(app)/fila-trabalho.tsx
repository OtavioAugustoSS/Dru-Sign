import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { CartaoIndicador } from '@/componentes/cartao-indicador'
import { BlocoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { NumeroOs } from '@/componentes/numero-os'
import { Apelido } from '@/componentes/situacao'
import { contar } from '@/componentes/plural'
import { haQuantosDias } from '@/componentes/tempo'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { Fila, OrdemDaFila } from '@/domain/caixa/fila'

function Cliente({ o }: { o: OrdemDaFila }) {
  return (
    <>
      {o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}
      <Apelido apelido={o.clienteApelido} />
    </>
  )
}

/**
 * A tela 1 da spec, movida da rota para ca quando `/` passou a decidir por papel.
 *
 * O que a vistoria pegou e o que mudou:
 *
 * - **Os dois cartoes ficavam lado a lado e desalinhados.** Um vazio e curto, o
 *   outro com catorze linhas: sobrava meia tela em branco a esquerda. Empilhados,
 *   cada um tem a altura que precisa, e as tabelas ganham a largura inteira -- o
 *   nome do cliente parou de quebrar em duas linhas.
 * - **A busca ocupava a largura toda**, 1170px de campo para digitar seis digitos.
 *   Continua sendo a acao principal da tela, so que com tamanho de campo.
 */
interface Props {
  fila: Fila
  ordens: { aberta: number; orcamento: number; concluida: number; aReceber: string }
  clientes: { total: number }
}

export function FilaDeTrabalho({ fila, ordens, clientes }: Props) {
  return (
    <>
      <CabecalhoPagina
        pretitulo="Atendimento"
        titulo="Fila de trabalho"
        acoes={
          <Link href="/ordens/nova" className="btn btn-primary">
            Nova ordem
          </Link>
        }
      />
      <CorpoPagina>
        <form method="get" action="/ordens" className="row mb-3" role="search">
          <div className="col-12 col-lg-6">
            <div className="input-icon">
              <span className="input-icon-addon">
                <IconSearch className="icon" />
              </span>
              <input
                type="search"
                name="q"
                className="form-control form-control-lg"
                placeholder="Número da OS, cliente ou apelido"
                aria-label="Buscar ordem"
                autoFocus
              />
            </div>
          </div>
        </form>

        {/* O painel do dia, e nao uma tela separada: esta JA e a primeira tela de
            quem abre o sistema, e um painel ao lado dela seria a mesma coisa
            duas vezes. Cada numero leva a tela que o detalha.

            "A cobrar" e o que a loja tem a receber de servico JA ENTREGUE --
            diferente do "a receber" da lista de ordens, que soma tudo o que foi
            faturado. Este e o dinheiro que ja deveria ter entrado, e e o numero
            que motivou trocar de sistema. */}
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Em produção" valor={ordens.aberta} href="/producao" nota="serviço em andamento" />
          </div>
          {/* "Serviço finalizado", e nao "entregue": o sistema registra que o
              trabalho ficou pronto, e nao que o cliente levou. Sao coisas
              diferentes -- a peca pode estar na prateleira ha semanas --, e
              dizer "entregue" e afirmar um fato que ninguem marcou. */}
          <div className="col-6 col-lg-3">
            <CartaoIndicador
              rotulo="A cobrar"
              valor={<Dinheiro valor={fila.totalACobrar} />}
              tom={Number(fila.totalACobrar) > 0 ? 'ruim' : 'bom'}
              href="/ordens?estado=concluida"
              nota="serviço finalizado e ainda não pago"
            />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Orçamentos" valor={ordens.orcamento} href="/ordens?estado=orcamento" nota="esperando aprovação" />
          </div>
          <div className="col-6 col-lg-3">
            <CartaoIndicador rotulo="Clientes" valor={clientes.total.toLocaleString('pt-BR')} href="/clientes" nota="cadastros ativos" />
          </div>
        </div>

        <CartaoTabela
          className="mb-3"
          rotulo="Ordens paradas"
          titulo="Abertas há mais de uma semana"
          aoLado={<span className="text-secondary">{contar(fila.paradas.length, 'ordem', 'ordens')}</span>}
          vazio={
            fila.paradas.length === 0 ? (
              <BlocoVazio
                titulo="Nenhuma ordem parada"
                descricao="É assim que deve ficar: nada aberto há mais de uma semana."
              />
            ) : null
          }
          colunas={
            <>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Aberta</th>
              <th>Entrega</th>
            </>
          }
        >
          {fila.paradas.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/ordens/${o.id}?de=fila`} className="text-reset fw-medium">
                  <NumeroOs numero={o.numero} />
                </Link>
              </td>
              <td><Cliente o={o} /></td>
              {/* Dias, e nao data: esta lista existe para dizer que a ordem esta
                  parada ha tempo demais, e "27/05/2026 00:38" obriga a fazer a
                  conta de cabeca em cada linha. A fila de producao ja resolveu
                  assim; a tela inicial e que tinha ficado para tras. */}
              <td className="text-secondary">{haQuantosDias(o.abertaEm)}</td>
              <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
            </tr>
          ))}
        </CartaoTabela>

        <CartaoTabela
          rotulo="Ordens a cobrar"
          titulo="Concluídas e não pagas"
          aoLado={
            <span className="fw-bold numero" data-testid="total-a-cobrar">
              <Dinheiro valor={fila.totalACobrar} />
            </span>
          }
          vazio={
            fila.aCobrar.length === 0 ? (
              <BlocoVazio
                titulo="Nada a cobrar"
                descricao="Todo serviço finalizado já foi recebido."
              />
            ) : null
          }
          colunas={
            <>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Finalizada</th>
              <th className="text-end">Falta</th>
            </>
          }
        >
          {fila.aCobrar.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/ordens/${o.id}?de=fila`} className="text-reset fw-medium">
                  <NumeroOs numero={o.numero} />
                </Link>
              </td>
              <td><Cliente o={o} /></td>
              <td className="text-secondary">{o.concluidaEm ? haQuantosDias(o.concluidaEm) : '—'}</td>
              <td className="numero"><Dinheiro valor={o.saldo} /></td>
            </tr>
          ))}
        </CartaoTabela>
      </CorpoPagina>
    </>
  )
}
