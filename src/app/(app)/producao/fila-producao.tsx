import Link from 'next/link'
import { IconPrinter } from '@tabler/icons-react'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { NumeroOs } from '@/componentes/numero-os'
import { Situacao, TEXTO_URGENCIA } from '@/componentes/situacao'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { ROTULO_URGENCIA, type GrupoDaFila, type OrdemDaProducao, type FilaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'
import { DetalheServico } from './detalhe-servico'
import { contar } from '@/componentes/plural'
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
  const pecas = ordem.itens.reduce((n, i) => n + i.quantidade, 0)

  return (
    // `data-tom` pinta a FAIXA da esquerda. Ela é o que se vê antes de ler: uma
    // coluna de cor descendo a página, vermelha onde atrasou e âmbar onde vence
    // hoje. Quem chega na bancada acha o trabalho urgente sem ler uma palavra.
    <li className="bancada-servico" data-tom={prazo.tom}>
      {/* Faixa 1 -- QUEM E QUANDO. Uma linha, corpo pequeno: é identificação, não
          é o trabalho. */}
      <div className="servico-identidade">
        <span className="bancada-os">
          <NumeroOs numero={ordem.numero} />
        </span>
        <Situacao tom={prazo.tom}>{prazo.texto}</Situacao>
        <span className="anotacao">{espera}</span>
        <span className="servico-cliente-nome">{nomeDoCliente(ordem)}</span>
        {telefone ? (
          <a className="servico-telefone" href={`tel:${telefone}`}>{formatarTelefone(telefone)}</a>
        ) : null}
        <span className="anotacao servico-responsavel">atendeu {ordem.responsavelNome}</span>
      </div>

      {/* Faixa 2 -- O TRABALHO. É a manchete, e ocupa a largura inteira. */}
      <div className="servico-trabalho">
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

      {/* O recado do balcão para a bancada. Estava no banco e não chegava aqui:
          quem produzia tinha de abrir a ordem para descobrir que havia recado --
          ou não descobria, e a peça saía errada. */}
      {ordem.observacoes?.trim() ? (
        <p className="servico-recado">{ordem.observacoes.trim()}</p>
      ) : null}

      {/* Faixa 3 -- O QUE DÁ PARA FAZER DAQUI.
          Três ações e três pesos. Finalizar muda o mundo e é a verde de 56px.
          Imprimir existe porque a peça vai para a bancada COM a folha: era o
          caminho mais usado da tela da ordem e obrigava a sair da fila para
          chegar nele. Ver o serviço é consulta. */}
      <div className="servico-acoes">
        <span className="servico-contagem anotacao-solta">
          {contar(pecas, 'peça', 'peças')} em {contar(ordem.itens.length, 'item', 'itens')}
        </span>
        <DetalheServico ordem={ordem} prazo={prazo} espera={espera} />
        <Link href={`/ordens/${ordem.id}/impresso`} className="btn bancada-imprimir">
          <IconPrinter className="icon" aria-hidden="true" />
          Imprimir
        </Link>
        <div className="servico-finalizar">
          <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
        </div>
      </div>
    </li>
  )
}
