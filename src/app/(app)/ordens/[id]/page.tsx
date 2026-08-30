import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconPrinter } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { valorEmReais } from '@/componentes/dinheiro'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { Anotacao, SituacaoEstado, SituacaoPagamento } from '@/componentes/situacao'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { prisma } from '@/infra/db/prisma'
import { obterOrdemParaTela } from '@/infra/ordens/repositorio'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { permissoes, ROTULO_ESTADO } from '@/domain/ordem/estados'
import { formatarDataCalendario, formatarDataHora, formatarDataLonga, hojeCalendario } from '@/domain/ordem/datas'
import { descreverCobranca, formatarDimensao } from '@/domain/ordem/impresso'
import type { MaterialCatalogo } from '@/domain/precificacao/resolucao'
import { EntradaLinha } from './entrada-linha'
import { BotaoMutacao } from './botao-mutacao'
import { FormAjuste } from './form-ajuste'
import { FormCabecalho } from './form-cabecalho'
import { FormCancelar } from './form-cancelar'
import { PainelPagamento } from './painel-pagamento'
import { removerItemAction, removerAcrescimoAction, confirmarAjusteAction, removerAjusteAction, aprovarOrcamentoAction } from './actions'

export const metadata: Metadata = { title: 'Ordem de serviço' }

const ROTULO_ACRESCIMO = { instalacao: 'Instalação', deslocamento: 'Deslocamento', frete: 'Frete', imposto: 'Imposto' } as const

export default async function PaginaOrdem({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const [ordem, materiais, usuarios] = await Promise.all([
    obterOrdemParaTela(usuario.empresaId, id),
    prisma.material.findMany({ where: { empresaId: usuario.empresaId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, unidadeCobranca: true, preco: true } }),
    prisma.usuario.findMany({ where: { empresaId: usuario.empresaId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ])
  if (!ordem) notFound()

  const pode = permissoes(ordem.estadoProducao)
  const catalogo: MaterialCatalogo[] = materiais.map((m) => ({ id: m.id, nome: m.nome, unidadeCobranca: m.unidadeCobranca, preco: m.preco.toFixed() }))
  const numero = formatarNumeroOs(ordem.numero)
  const acao = <A extends unknown[]>(fn: (ordemId: string, versao: number, ...rest: [...A, string]) => ReturnType<typeof removerItemAction>, ...args: A) =>
    fn.bind(null, ordem.id, ordem.versao, ...args) as (chave: string) => ReturnType<typeof removerItemAction>

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/ordens', rotulo: 'Ordens' }}
        titulo={`${ordem.estadoProducao === 'orcamento' ? 'Orçamento' : 'Ordem de serviço'} nº ${numero}`}
        descricao={
          <>
            {/* Estado como selo, igual ao resto do sistema. Antes era texto cinza
                em maiusculas aqui e selo colorido na lista: a mesma informacao
                com duas caras. Cancelada nao recebe (o dominio recusa), entao
                mostrar "Nao pago" ao lado seria promessa de cobranca. */}
            <span className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <SituacaoEstado estado={ordem.estadoProducao} />
              {ordem.estadoProducao === 'cancelada' ? null : <SituacaoPagamento estado={ordem.pagamento.estado} />}
              {ordem.concluidaEm ? <span>serviço finalizado em {formatarDataHora(new Date(ordem.concluidaEm))}</span> : null}
              {ordem.canceladaEm ? <span>{ordem.motivoCancelamento}</span> : null}
            </span>
            <span className="d-block">
              {ordem.cliente ? <>{ordem.cliente.nome}{ordem.cliente.apelido ? ` · ${ordem.cliente.apelido}` : ''}{ordem.cliente.telefone ? ` · ${formatarTelefone(ordem.cliente.telefone.replace(/\D/g, ''))}` : ''}</> : 'Venda de balcão'}
              {' · aberta em '}{formatarDataHora(new Date(ordem.abertaEm))}
              {ordem.prometidaPara ? ` · entrega prometida ${formatarDataLonga(new Date(ordem.prometidaPara))}` : ''}
            </span>
          </>
        }
        acoes={
          <Link href={`/ordens/${ordem.id}/impresso`} className="btn">
            <IconPrinter className="icon" /> Imprimir
          </Link>
        }
      />

      <CorpoPagina>
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="card mb-3">
                <div className="card-body">
                  <FormCabecalho ordemId={ordem.id} versao={ordem.versao} cliente={ordem.cliente} prometidaPara={ordem.prometidaPara}
                    responsavelId={ordem.responsavel.id} usuarios={usuarios} observacoes={ordem.observacoes} somenteObservacoes={!pode.editarCabecalho} />
                </div>
              </div>

              <div className="card">
                {pode.editarItens ? <EntradaLinha ordemId={ordem.id} versao={ordem.versao} catalogo={catalogo} /> : (
                  <div className="card-body text-secondary">{ROTULO_ESTADO[ordem.estadoProducao]}: os itens não podem mais ser alterados.</div>
                )}
                <div className="table-responsive">
                  <table className="table table-vcenter card-table" aria-label="Itens da ordem">
                    <thead><tr><th className="text-end">Qtd</th><th>Descrição</th><th>Medida</th><th className="text-end">Unitário</th><th className="text-end">Total</th><th className="w-1"></th></tr></thead>
                    <tbody>
                      {ordem.itens.length === 0 ? <tr><td colSpan={6} className="text-secondary">Nenhum item ainda. Digite a primeira linha acima.</td></tr> : null}
                      {ordem.itens.map((i) => {
                        const altura = i.altura === null ? null : Number(i.altura)
                        const largura = i.largura === null ? null : Number(i.largura)
                        return (
                          <tr key={i.id}>
                            <td className="numero">{i.quantidade}</td>
                            <td>{i.descricao}<div className="small text-secondary">{descreverCobranca({ quantidade: i.quantidade, descricao: i.descricao, unidade: i.unidadeCobranca, altura, largura, valorUnitario: dinheiro(i.valorUnitario), total: dinheiro(i.total) })}</div></td>
                            <td className="text-secondary">{formatarDimensao(altura, largura)}</td>
                            <td className="numero">{valorEmReais(i.valorUnitario)}</td>
                            <td className="numero">{valorEmReais(i.total)}</td>
                            <td>{pode.editarItens ? <BotaoMutacao acao={acao(removerItemAction, i.id)} rotulo="Remover" className="btn btn-ghost-danger btn-sm" /> : null}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card">
                <div className="card-body">
                  <dl className="row mb-0">
                    <dt className="col-7">Materiais e serviços</dt><dd className="col-5 numero">{valorEmReais(ordem.subtotalItens)}</dd>
                    {ordem.acrescimos.map((a) => (
                      <div className="row g-0 col-12" key={a.id}>
                        <dt className="col-7 fw-normal">{ROTULO_ACRESCIMO[a.tipo]}{a.descricao ? ` · ${a.descricao}` : ''}</dt>
                        <dd className="col-5 numero d-flex justify-content-end gap-2">{valorEmReais(a.valor)}{pode.editarItens ? <BotaoMutacao acao={acao(removerAcrescimoAction, a.id)} rotulo="Remover" className="btn btn-ghost-danger btn-sm py-0" /> : null}</dd>
                      </div>
                    ))}
                    <dt className="col-7">Calculado</dt><dd className="col-5 numero">{valorEmReais(ordem.precoCalculado)}</dd>
                    <dt className="col-7">Preço final{ordem.ajuste ? <Anotacao tom="marca">ajustado</Anotacao> : null}</dt>
                    <dd className="col-5 numero fs-2 fw-bold" data-testid="preco-final">{valorEmReais(ordem.precoFinal)}</dd>
                  </dl>
                  {ordem.ajuste ? (
                    <div className="small text-secondary">
                      {dinheiro(ordem.precoFinal).lt(ordem.precoCalculado) ? 'Desconto' : 'Acréscimo'} de {valorEmReais(dinheiro(ordem.precoFinal).minus(ordem.precoCalculado).abs().toFixed(2))} · {ordem.ajuste.motivo}, por {ordem.ajuste.por}
                    </div>
                  ) : null}
                  {ordem.ajuste?.desatualizado ? (
                    <div className="alert alert-warning mt-3" role="alert">
                      O calculado passou de {valorEmReais(ordem.ajuste.precoCalculadoNoAjuste)} para {valorEmReais(ordem.precoCalculado)}. O preço final continua {valorEmReais(ordem.precoFinal)}.
                      <div className="d-flex gap-2 mt-2">
                        <BotaoMutacao acao={acao(confirmarAjusteAction)} rotulo={`Manter ${valorEmReais(ordem.precoFinal)}`} className="btn btn-warning btn-sm" />
                        <BotaoMutacao acao={acao(removerAjusteAction)} rotulo="Usar o calculado" className="btn btn-sm" />
                      </div>
                    </div>
                  ) : null}
                  {ordem.aprovadoEm ? <div className="small text-secondary mt-2">Orçamento aprovado em {formatarDataHora(new Date(ordem.aprovadoEm))} por {valorEmReais(ordem.precoAprovado ?? '0')}</div> : null}
                </div>
                {pode.editarPreco ? (
                  <div className="card-body border-top">
                    {/* Dobrado, e aberto quando ja existe ajuste. Ajustar preco e
                        excecao, nao o caminho normal -- e o formulario aberto punha
                        um campo "Preco final" a 60px do total "Preco final", com
                        sentidos diferentes: um le, o outro escreve. */}
                    <details open={Boolean(ordem.ajuste)}>
                      <summary className="fw-medium">Ajustar o preço</summary>
                      <div className="mt-3">
                        {/* key no preco: mudou o total (item novo, acrescimo), o campo do ajuste
                            volta a mostrar o valor de agora em vez do que estava na tela antes. */}
                        <FormAjuste key={ordem.precoFinal} ordemId={ordem.id} versao={ordem.versao} precoFinal={ordem.precoFinal} motivo={ordem.ajuste?.motivo ?? ''} />
                        {ordem.ajuste && !ordem.ajuste.desatualizado ? <div className="mt-2"><BotaoMutacao acao={acao(removerAjusteAction)} rotulo="Remover ajuste" className="btn btn-link px-0" /></div> : null}
                      </div>
                    </details>
                  </div>
                ) : null}
                <div className="card-body border-top d-flex flex-column gap-2">
                  {pode.aprovarOrcamento ? <BotaoMutacao acao={acao(aprovarOrcamentoAction)} rotulo="Aprovar orçamento" className="btn btn-primary" /> : null}
                  {pode.cancelar ? <FormCancelar ordemId={ordem.id} versao={ordem.versao} /> : null}
                  {ordem.prometidaPara ? <div className="small text-secondary">Entrega prometida para {formatarDataCalendario(new Date(ordem.prometidaPara))}</div> : null}
                </div>
              </div>
              <div className="mt-3">
                {/* key no saldo: item novo, acrescimo ou recebimento mudam o que falta, e o campo
                    de valor volta a nascer do saldo de agora em vez do que estava na tela antes. */}
                <PainelPagamento key={ordem.pagamento.saldo} ordemId={ordem.id} versao={ordem.versao} estadoProducao={ordem.estadoProducao} pagamento={ordem.pagamento}
                  recebimentos={ordem.recebimentos} hoje={hojeCalendario(new Date())} podeConcluir={pode.concluir} podeReceber={pode.receber}
                  administracao={usuario.papel === 'administracao'} />
              </div>
            </div>
          </div>
      </CorpoPagina>
    </>
  )
}
