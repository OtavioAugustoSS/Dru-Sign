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
  rodape?: ReactNode
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
export function CartaoTabela({ rotulo, colunas, children, titulo, aoLado, rodape, denso, className }: Props) {
  return (
    <div className={className ? `card ${className}` : 'card'}>
      {titulo || aoLado ? (
        <div className="card-header">
          {titulo ? <h3 className="card-title">{titulo}</h3> : null}
          {aoLado ? <div className="ms-auto">{aoLado}</div> : null}
        </div>
      ) : null}
      <div className="table-responsive">
        <table className={`table table-vcenter card-table${denso ? ' table-sm' : ''}`} aria-label={rotulo}>
          <thead>
            <tr>{colunas}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {rodape ? <div className="card-footer text-secondary">{rodape}</div> : null}
    </div>
  )
}
