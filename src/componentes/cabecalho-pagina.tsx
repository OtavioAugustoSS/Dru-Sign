import type { ReactNode } from 'react'
import Link from 'next/link'
import { IconChevronLeft } from '@tabler/icons-react'

interface Props {
  /** O nome da tela. E o unico campo obrigatorio. */
  titulo: ReactNode
  /** A area do sistema, acima do titulo. */
  pretitulo?: ReactNode
  /**
   * A tela de onde se chega aqui. Quando existe, ocupa o lugar do pretitulo e
   * vira um caminho de volta clicavel.
   *
   * Fixo, nao "voltar do navegador": destino previsivel vale mais que destino
   * exato. Quem chegou na ficha pela busca e quem chegou pela carteira querem a
   * mesma coisa -- a lista de clientes -- e o botao do navegador continua ali
   * para quem quer desfazer o ultimo passo.
   */
  voltar?: { href: string; rotulo: string }
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
export function CabecalhoPagina({ titulo, pretitulo, voltar, descricao, acoes, grande }: Props) {
  return (
    <div className="page-header d-print-none">
      <div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col">
            {voltar ? (
              <div className="page-pretitle">
                <Link href={voltar.href} className="trilha-voltar">
                  <IconChevronLeft className="icon" />
                  {voltar.rotulo}
                </Link>
              </div>
            ) : pretitulo ? (
              <div className="page-pretitle">{pretitulo}</div>
            ) : null}
            <h1 className={grande ? 'page-title fs-1' : 'page-title'}>{titulo}</h1>
            {/* Largura travada: no monitor da loja (1.920 px) a descricao ia de
                ponta a ponta, uma linha de mais de 90 caracteres. O olho perde
                o comeco da linha seguinte muito antes disso. */}
            {descricao ? <div className="text-secondary cabecalho-descricao">{descricao}</div> : null}
          </div>
          {acoes ? <div className="col-auto d-flex gap-2">{acoes}</div> : null}
        </div>
      </div>
    </div>
  )
}
