import Link from 'next/link'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { NumeroOs } from '@/componentes/numero-os'
import { TEXTO_URGENCIA } from '@/componentes/selo'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { ROTULO_URGENCIA, type GrupoDaFila, type OrdemDaProducao, type FilaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'

/**
 * A fila da bancada: densidade baixa, tipo grande, lida de longe (spec, tela 8).
 *
 * O que mudou depois da vistoria, e por que:
 *
 * - **O que fazer virou o maior bloco do cartao.** Antes o item ficava em letra
 *   miuda, com marcador, depois do nome do cliente; e o item e exatamente o que a
 *   producao precisa ler para trabalhar.
 * - **A data aparece uma vez, nao duas.** Cada cartao trazia "Entrega 4 de
 *   setembro" E "04/09/2026", a mesma informacao repetida.
 * - **Cada grupo abre e fecha.** A tela tinha 13.045px de altura porque despejava
 *   as ~100 ordens de uma vez, e 87 delas eram do grupo "sem data combinada", que
 *   nao e fila: e pendencia de combinar prazo. Os grupos com prazo nascem
 *   abertos; o sem data nasce fechado, com a contagem a vista.
 * - **O verde deixou de ser o fundo da tela.** Nao mudou o botao: mudou o peso do
 *   resto. Cem botoes verdes iguais faziam o verde nao significar nada, e o
 *   numero da OS era menor que o botao.
 */
export function FilaDeProducao({ fila }: { fila: FilaProducao }) {
  return (
    <>
      <CabecalhoPagina
        grande
        pretitulo="Produção"
        titulo="Fila de produção"
        acoes={
          fila.total === 0 ? null : (
            <span className="fs-3">
              {fila.total} em produção
              {fila.atrasadas > 0 ? (
                <span className="text-danger-emphasis fw-bold ms-2">
                  · {fila.atrasadas} atrasada{fila.atrasadas > 1 ? 's' : ''}
                </span>
              ) : null}
            </span>
          )
        }
      />
      <CorpoPagina>
        {fila.total === 0 ? (
          <EstadoVazio
            titulo="Nada na fila"
            descricao="Todo serviço aberto já foi finalizado. Quando o atendimento abrir uma ordem, ela aparece aqui."
          />
        ) : (
          fila.grupos.map((g) => <Grupo key={g.grupo} grupo={g} />)
        )}
      </CorpoPagina>
    </>
  )
}

function Grupo({ grupo }: { grupo: GrupoDaFila }) {
  const semPrazo = grupo.grupo === 'sem_data'
  const atrasado = grupo.grupo === 'atrasada'

  return (
    // `open` por padrao em tudo que tem prazo. O grupo sem data e o unico que
    // nasce fechado: sao ordens esperando alguem combinar entrega, nao trabalho
    // da vez. A contagem fica a vista, entao nada some em silencio.
    <details className="mb-4" open={!semPrazo}>
      {/* O nome do grupo e um h2, nao so texto dentro do `summary`. Esta tela
          nao tinha titulo nenhum abaixo do h1: quem usa leitor de tela via uma
          lista de ~100 cartoes sem nada para separar "Atrasadas" de "Hoje". O
          `fw-normal` e proposital -- mantem o peso que o summary ja tinha, para
          a tela sair igual, e as classes ficam no `summary` para o marcador de
          abrir/fechar manter a cor da urgencia (conferido por diff de pixel). */}
      <summary className={`fs-2 mb-3 ${TEXTO_URGENCIA[grupo.grupo]}`}>
        <h2 className="fs-2 fw-normal d-inline">
          {ROTULO_URGENCIA[grupo.grupo]} <span className="text-secondary">({grupo.ordens.length})</span>
        </h2>
      </summary>
      <div className="row g-3">
        {grupo.ordens.map((o) => (
          <Cartao key={o.id} ordem={o} atrasada={atrasado} />
        ))}
      </div>
    </details>
  )
}

function Cartao({ ordem, atrasada }: { ordem: OrdemDaProducao; atrasada: boolean }) {
  const cliente = ordem.clienteApelido ?? ordem.clienteNome

  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className={`card h-100${atrasada ? ' border-danger' : ''}`}>
        <div className="card-body">
          <div className="d-flex align-items-baseline justify-content-between gap-2">
            <Link href={`/ordens/${ordem.id}`} className="text-reset text-decoration-none fs-1 fw-bold numero">
              <NumeroOs numero={ordem.numero} />
            </Link>
            {ordem.prometidaPara ? (
              <span className={`fs-3 ${atrasada ? 'text-danger-emphasis fw-bold' : ''}`}>
                {formatarDataCalendario(new Date(ordem.prometidaPara))}
              </span>
            ) : (
              <span className="fs-4 text-secondary">sem data</span>
            )}
          </div>

          <div className="fs-4 text-secondary mb-3">{cliente ?? 'Venda de balcão'}</div>

          {/* O trabalho. E o maior bloco do cartao de proposito. */}
          <ul className="list-unstyled fs-2 mb-0">
            {ordem.itens.length === 0 ? (
              <li className="fs-4 text-secondary">Nenhum item lançado nesta ordem</li>
            ) : (
              ordem.itens.map((i, n) => (
                <li className="mb-1" key={`${ordem.id}-${n}`}>
                  {i}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card-footer">
          <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
        </div>
      </div>
    </div>
  )
}
