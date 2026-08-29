import type { ReactNode } from 'react'

interface Props {
  /** O nome da tela. E o unico campo obrigatorio. */
  titulo: ReactNode
  /** A area do sistema, acima do titulo. */
  pretitulo?: ReactNode
  /** Uma linha de contexto abaixo do titulo, quando o titulo sozinho nao basta. */
  descricao?: ReactNode
  /** Botoes e links do canto direito. */
  acoes?: ReactNode
  /**
   * Tipo maior. So a fila de producao usa: ela e lida de longe, de pe na
   * bancada, e nao de perto como as telas do balcao (spec, tela 8).
   */
  grande?: boolean
}

/**
 * O cabecalho de toda tela. Antes disto ele estava copiado em 20 arquivos, em
 * duas variantes que divergiram: umas usavam `me-2` entre os botoes, outras
 * `gap-2`, e duas telas tinham uma terceira linha que as demais nao tinham.
 *
 * `d-print-none` porque o cabecalho da tela nao vai para o papel.
 */
export function CabecalhoPagina({ titulo, pretitulo, descricao, acoes, grande }: Props) {
  return (
    <div className="page-header d-print-none">
      <div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col">
            {pretitulo ? <div className="page-pretitle">{pretitulo}</div> : null}
            <h1 className={grande ? 'page-title fs-1' : 'page-title'}>{titulo}</h1>
            {descricao ? <div className="text-secondary">{descricao}</div> : null}
          </div>
          {acoes ? <div className="col-auto d-flex gap-2">{acoes}</div> : null}
        </div>
      </div>
    </div>
  )
}
