import type { ReactNode } from 'react'

interface Props {
  /** O que nao existe ainda, em uma linha. */
  titulo: string
  /** Por que esta vazio e o que fazer a respeito. E a parte que ensina. */
  descricao?: ReactNode
  /** O proximo passo, quando existe um. */
  acoes?: ReactNode
}

/**
 * O miolo do estado vazio, sem cartao em volta.
 *
 * Serve para dentro de um cartao que ja tem cabecalho proprio -- ali um segundo
 * cartao seria cartao dentro de cartao.
 */
export function BlocoVazio({ titulo, descricao, acoes }: Props) {
  return (
    <div className="empty">
      <p className="empty-title">{titulo}</p>
      {descricao ? <p className="empty-subtitle text-secondary">{descricao}</p> : null}
      {acoes ? <div className="empty-action d-flex gap-2 justify-content-center">{acoes}</div> : null}
    </div>
  )
}

/**
 * A tela quando nao ha nada para mostrar. Ate aqui conviviam tres tratamentos
 * para a mesma situacao: o bloco `.empty` do Tabler em 8 telas, uma frase solta
 * em `card-body text-secondary` em 4, e um `<td colSpan>` numa. Este e o unico.
 *
 * A descricao ensina o proximo passo em vez de anunciar o vazio -- e a diferenca
 * entre "nenhum resultado" e "a carteira nasce das ordens; venda de balcao nao
 * entra: ela nao tem nome".
 */
export function EstadoVazio(props: Props) {
  return (
    <div className="card">
      <div className="card-body">
        <BlocoVazio {...props} />
      </div>
    </div>
  )
}
