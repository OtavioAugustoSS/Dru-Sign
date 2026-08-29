import type { ReactNode } from 'react'

/**
 * O conteudo da tela, dentro da mesma largura maxima do cabecalho. Estava
 * copiado em 22 arquivos; existe para que a largura da coluna de leitura seja
 * decidida num lugar so.
 */
export function CorpoPagina({ children }: { children: ReactNode }) {
  return (
    <div className="page-body">
      <div className="container-xl">{children}</div>
    </div>
  )
}
