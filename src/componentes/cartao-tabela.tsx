import type { ReactNode } from 'react'

interface Props {
  /** Nome da tabela para quem usa leitor de tela. Obrigatorio: tabela sem nome nao se navega. */
  rotulo: string
  /** As celulas de cabecalho, sem o `<tr>` em volta. */
  colunas: ReactNode
  /** As linhas do corpo. */
  children: ReactNode
  titulo?: ReactNode
  /** Contagem ou total, alinhado a direita do titulo. */
  aoLado?: ReactNode
  /**
   * Virada de pagina no CABECALHO, ao lado da contagem.
   *
   * Cinquenta linhas dao uma pagina de quase tres mil pixels; a do historico
   * passa de cinco mil. Com a paginacao so no rodape, ela ficava a varias telas
   * de rolagem -- e quem abria a lista concluia que ela nao tinha paginacao.
   */
  paginacao?: ReactNode
  rodape?: ReactNode
  /**
   * O que mostrar no lugar da tabela quando nao ha linha nenhuma. O cabecalho do
   * cartao continua, porque ele diz DO QUE esta vazio.
   */
  vazio?: ReactNode
  /** Espacamento menor, para tabelas dentro de painel. */
  denso?: boolean
  className?: string
}

/**
 * Cartao com tabela dentro. Estava copiado em 11 telas, sempre com as mesmas
 * quatro camadas de div (`card` > `table-responsive` > `table` > `thead`), e o
 * `aria-label` ficava a criterio de quem escrevia a tela — por isso e prop
 * obrigatoria aqui.
 */
export function CartaoTabela({ rotulo, colunas, children, titulo, aoLado, paginacao, rodape, vazio, denso, className }: Props) {
  return (
    <div className={className ? `card ${className}` : 'card'}>
      {titulo || aoLado || paginacao ? (
        <div className="card-header">
          {/* h2, nao h3: o titulo da tela e h1, e pular nivel quebra a lista
              de titulos que o leitor de tela oferece. O `.card-title` fixa o
              tamanho, entao a tag nao muda nada de aparencia. */}
          {titulo ? <h2 className="card-title">{titulo}</h2> : null}
          {/* A classe existe para o CSS poder perguntar se sobrou alguma coisa
              aqui dentro. `paginacao` chega como elemento React, que e sempre
              verdadeiro, mas a `PaginacaoCompacta` devolve `null` quando a lista
              cabe numa pagina so -- e a tela de Ordens desenhava uma faixa de
              cabecalho de 33px sem nada escrito nela. */}
          <div className="ms-auto d-flex align-items-center gap-3 cabecalho-extras">
            {aoLado}
            {paginacao}
          </div>
        </div>
      ) : null}
      {vazio ? (
        <div className="card-body">{vazio}</div>
      ) : (
        <div className="table-responsive">
          {/* `table-hover` estava disponivel e nao era usada em lugar nenhum, e as
              listas daqui tem de 25 a 50 linhas e ate 8 colunas -- a da carteira
              mede 1.264px de largura. Numa linha dessas o olho vai do nome, na
              ponta esquerda, ate a fatia do faturamento, na direita, e sem realce
              ele sobe ou desce uma linha no caminho. */}
          <table className={`table table-vcenter card-table table-hover${denso ? ' table-sm' : ''}`} aria-label={rotulo}>
            <thead>
              <tr>{colunas}</tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
      {rodape ? <div className="card-footer text-secondary">{rodape}</div> : null}
    </div>
  )
}
