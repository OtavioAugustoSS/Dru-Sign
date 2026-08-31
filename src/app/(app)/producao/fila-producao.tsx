import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { NumeroOs } from '@/componentes/numero-os'
import { Situacao, TEXTO_URGENCIA } from '@/componentes/situacao'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { ROTULO_URGENCIA, type GrupoDaFila, type OrdemDaProducao, type FilaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'
import { DetalheServico } from './detalhe-servico'
import { esperaDe, nomeDoCliente, prazoDe } from './prazo'

/**
 * A fila da bancada.
 *
 * O que a versão anterior errava, e o Otavio nomeou em uma frase: parecia feita
 * por IA. Estava certo, e a causa dá para apontar com o dedo. O cartão eram
 * quatro faixas do MESMO peso, empilhadas, com risco entre todas, tarja colorida
 * no topo e dois botões gêmeos no rodapé -- separação feita só por linha, sem
 * hierarquia nenhuma de tipo ou de espaço. É a gramática que um gerador produz
 * quando lê "separe cada informação" e desenha uma caixa em volta de cada uma.
 *
 * E havia um erro anterior a esse, de conteúdo: o número da OS era a manchete.
 * Quem está de pé com a chapa na mão não pergunta "qual o número?"; pergunta "o
 * que eu faço agora?". O trabalho é a manchete. O número é etiqueta.
 */
export function FilaDeProducao({ fila }: { fila: FilaProducao }) {
  const agora = new Date()
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
          fila.grupos.map((g) => (
            <Grupo key={g.grupo} grupo={g} unico={fila.grupos.length === 1} agora={agora} />
          ))
        )}
      </CorpoPagina>
    </>
  )
}

/* Sem cartão, sem tarja, sem risco entre as partes. O que separa uma informação
 * da outra é o TAMANHO e o ESPAÇO: o trabalho em corpo grande ocupando a largura,
 * o resto em corpo pequeno e cor secundária, encostado na direita. Entre um
 * serviço e outro, uma linha só.
 *
 * A coluna das quantidades é o detalhe que faz a lista funcionar de longe: "12",
 * "2", "30" alinhados à direita em dígitos tabulares formam uma borda numérica
 * reta, e o olho desce por ela sem ler palavra nenhuma. */

function Grupo({ grupo, unico, agora }: { grupo: GrupoDaFila; unico: boolean; agora: Date }) {
  const semPrazo = grupo.grupo === 'sem_data'
  return (
    <details className="grupo-fila" open={!semPrazo || unico}>
      <summary className="grupo-titulo">
        <h2 className={`fs-2 fw-normal d-inline ${TEXTO_URGENCIA[grupo.grupo]}`}>
          {ROTULO_URGENCIA[grupo.grupo]} <span className="text-secondary">({grupo.ordens.length})</span>
        </h2>
      </summary>
      <ol className="bancada-lista">
        {grupo.ordens.map((o) => (
          <Servico key={o.id} ordem={o} agora={agora} />
        ))}
      </ol>
    </details>
  )
}

function Servico({ ordem, agora }: { ordem: OrdemDaProducao; agora: Date }) {
  const prazo = prazoDe(ordem, agora)
  const espera = esperaDe(ordem, agora)
  const telefone = ordem.clienteTelefone?.replace(/\D/g, '') ?? ''

  return (
    <li className="bancada-servico">
      <div className="bancada-trabalho">
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

      <div className="bancada-meta">
        <span className="bancada-os">
          <NumeroOs numero={ordem.numero} />
        </span>
        <Situacao tom={prazo.tom}>{prazo.texto}</Situacao>
        <span className="bancada-cliente">{nomeDoCliente(ordem)}</span>
        {telefone ? (
          <a className="text-secondary" href={`tel:${telefone}`}>{formatarTelefone(telefone)}</a>
        ) : null}
        {/* "Ver o serviço" mora aqui e não na coluna das ações: empilhado sob o
            botão verde, ele esticava a linha de um serviço de um item só em 76px
            de ar. Aqui ele é o que é -- consulta, ao lado do resto do contexto. */}
        <DetalheServico ordem={ordem} prazo={prazo} espera={espera} />
      </div>

      <div className="bancada-acao">
        <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
      </div>
    </li>
  )
}
