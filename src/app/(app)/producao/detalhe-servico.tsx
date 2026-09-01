'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconExternalLink, IconPhone, IconX } from '@tabler/icons-react'
import { Situacao } from '@/componentes/situacao'
import { formatarDataLonga } from '@/domain/ordem/datas'
import { formatarTelefone } from '@/domain/clientes/telefone'
import type { OrdemDaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'
import type { Prazo } from './prazo'

interface Props {
  ordem: OrdemDaProducao
  prazo: Prazo
  espera: string
  /** A classe do BOTAO que abre. O detalhe em si nao muda de aparencia. */
  classe?: string
}

/**
 * O serviço inteiro, sem sair da fila.
 *
 * `<dialog>` do navegador, e não uma caixa desenhada à mão: ele já traz prender o
 * foco dentro, fechar no Esc e o fundo escurecido -- as três coisas que uma
 * "modal" caseira erra. O JavaScript daqui são duas linhas, `showModal` e
 * `close`, porque a API só abre por chamada.
 *
 * Esta tela serve duas mãos diferentes: o balcão, sentado com mouse, consultando
 * "a placa do fulano está pronta?"; e a bancada, de pé e às vezes de luva. Por
 * isso os alvos são grandes e há três saídas -- o X, o Esc e o clique fora --
 * em vez de só um X pequeno no canto.
 *
 * O conteúdo só nasce quando alguém abre. A fila chega a ter uma centena de
 * ordens; montar cem diálogos fechados significaria montar cem vezes o botão de
 * finalizar que vive dentro deles, e este sistema tem quase nenhum JavaScript no
 * navegador por escolha, não por acaso. Fechado, isto aqui é um botão e nada mais.
 */
export function DetalheServico({ ordem, prazo, espera, classe = 'btn bancada-ver' }: Props) {
  const caixa = useRef<HTMLDialogElement>(null)
  const [aberto, setAberto] = useState(false)
  const telefone = ordem.clienteTelefone?.replace(/\D/g, '') ?? ''

  // `showModal` só existe depois que o elemento entra na árvore, então a abertura
  // acontece no efeito que segue o estado -- e não no clique.
  useEffect(() => {
    if (aberto) caixa.current?.showModal()
  }, [aberto])

  const fechar = () => { caixa.current?.close(); setAberto(false) }

  return (
    <>
      <button
        type="button"
        className={classe}
        onClick={() => setAberto(true)}
      >
        Ver o serviço
      </button>

      {!aberto ? null : (
      <dialog
        ref={caixa}
        className="detalhe-servico"
        aria-labelledby={`detalhe-${ordem.id}`}
        // Clique no FUNDO fecha. O alvo do clique é o próprio <dialog> apenas
        // quando o ponteiro cai fora do conteúdo, então comparar o alvo basta --
        // sem medir coordenadas e sem escutar o documento inteiro.
        onClick={(e) => { if (e.target === caixa.current) fechar() }}
        // Esc fecha por conta do navegador; o estado precisa saber disso para o
        // conteúdo poder ser desmontado.
        onClose={() => setAberto(false)}
      >
        {/* Envolve o conteúdo para o clique no fundo poder ser distinguido:
            só o que cai FORA desta caixa tem o <dialog> como alvo. */}
        <div>
          <header className="detalhe-faixa">
            {/* `autoFocus` no titulo e nao no X: sem isso o `showModal` foca o
                primeiro elemento focavel, que e o botao de fechar -- quem chega
                pelo teclado ou pelo leitor de tela comeca ouvindo "Fechar" e um
                Enter distraido fecha o que acabou de abrir. `tabIndex={-1}`
                porque titulo nao entra na ordem de tabulacao; ele so recebe o
                foco desta vez. */}
            <div tabIndex={-1} autoFocus>
              <h2 className="detalhe-numero" id={`detalhe-${ordem.id}`}>
                Ordem {String(ordem.numero).padStart(6, '0')}
              </h2>
              <div className="mt-1">
                <Situacao tom={prazo.tom}>{prazo.texto}</Situacao>
                <span className="anotacao">{espera}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-icon botao-producao"
              onClick={fechar}
              aria-label="Fechar"
            >
              <IconX className="icon" />
            </button>
          </header>

          {/* O trabalho vem primeiro e em corpo grande: e o que a pessoa
              abriu para ver. Cliente e prazo sao contexto e ficam abaixo, em
              corpo pequeno -- hierarquia por tamanho, sem etiqueta em caixa alta
              nomeando cada bloco. */}
          <div className="detalhe-trabalho">
            {ordem.itens.length === 0 ? (
              <p className="anotacao-solta m-0">Nenhum item lançado nesta ordem</p>
            ) : (
              ordem.itens.map((i, n) => (
                <p className="bancada-item" key={`${ordem.id}-${n}`}>
                  <span className="bancada-qtd numero">{i.quantidade}</span>
                  <span>
                    {i.descricao}
                    {i.medida ? <span className="bancada-medida">{i.medida}</span> : null}
                  </span>
                </p>
              ))
            )}
          </div>

          <dl className="detalhe-contexto">
            <dt>Cliente</dt>
            <dd>
              {ordem.clienteNome ?? 'Venda de balcão'}
              {ordem.clienteApelido ? <span className="anotacao">{ordem.clienteApelido}</span> : null}
            </dd>

            <dt>Telefone</dt>
            <dd>
              {telefone ? (
                // `tel:` porque no celular da bancada isto disca, e no computador
                // do balcao continua sendo so o numero, legivel e copiavel.
                <a href={`tel:${telefone}`}>{formatarTelefone(telefone)}</a>
              ) : (
                <span className="text-secondary">não ficou registrado nesta ordem</span>
              )}
            </dd>

            <dt>Entrega</dt>
            <dd>
              {ordem.prometidaPara
                ? formatarDataLonga(new Date(ordem.prometidaPara))
                : <span className="text-secondary">ninguém combinou com o cliente</span>}
            </dd>

            <dt>Aberta em</dt>
            <dd>{formatarDataLonga(new Date(ordem.abertaEm))}</dd>
          </dl>

          <footer className="detalhe-acoes">
            <Link href={`/ordens/${ordem.id}?de=producao`} className="btn botao-producao">
              <IconExternalLink className="icon" aria-hidden="true" />
              Abrir a ordem
            </Link>
            <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
          </footer>
        </div>
      </dialog>
      )}
    </>
  )
}
