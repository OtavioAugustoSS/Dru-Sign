import Link from 'next/link'

/** Quantas linhas cabem numa tela sem virar rolagem infinita. */
export const POR_PAGINA = 50

interface Props {
  /** 1 e a primeira. */
  pagina: number
  porPagina: number
  /** Quantas linhas o filtro encontra no total, nao quantas esta mostrando. */
  total: number
  /** O endereco da tela, sem parametros. */
  base: string
  /** Os filtros em vigor, para nao se perderem ao virar a pagina. */
  parametros: Record<string, string | undefined>
}

/**
 * Rodape de "mostrando X a Y de Z", com anterior e proxima.
 *
 * Sao links de verdade, sem JavaScript: a pagina entra no endereco, entao dá para
 * voltar pelo botao do navegador e guardar o link.
 *
 * Nao desenha numero de pagina um a um: com 18 mil linhas isso vira uma regua
 * inutil. Quem procura algo especifico usa a busca, nao a pagina 47.
 */
export function Paginacao({ pagina, porPagina, total, base, parametros }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, total)

  const endereco = (p: number) => {
    const busca = new URLSearchParams()
    for (const [chave, valor] of Object.entries(parametros)) {
      if (valor) busca.set(chave, valor)
    }
    if (p > 1) busca.set('pagina', String(p))
    const texto = busca.toString()
    return texto ? `${base}?${texto}` : base
  }

  // Uma pagina so: a contagem ainda ajuda, os botoes nao.
  const soUmaPagina = paginas <= 1

  // Sem `card-footer` aqui: quem embrulha e o CartaoTabela, e dois rodapes
  // aninhados dariam duas bordas e dois espacamentos.
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <p className="m-0 text-secondary">
        Mostrando <strong>{primeiro}</strong> a <strong>{ultimo}</strong> de <strong>{total}</strong>
      </p>
      {soUmaPagina ? null : (
        <nav aria-label="Páginas">
          <ul className="pagination m-0">
            <li className={pagina <= 1 ? 'page-item disabled' : 'page-item'}>
              {pagina <= 1 ? (
                <span className="page-link" aria-disabled="true">
                  Anterior
                </span>
              ) : (
                <Link className="page-link" href={endereco(pagina - 1)} rel="prev">
                  Anterior
                </Link>
              )}
            </li>
            <li className="page-item disabled">
              <span className="page-link" aria-current="page">
                Página {pagina} de {paginas}
              </span>
            </li>
            <li className={pagina >= paginas ? 'page-item disabled' : 'page-item'}>
              {pagina >= paginas ? (
                <span className="page-link" aria-disabled="true">
                  Próxima
                </span>
              ) : (
                <Link className="page-link" href={endereco(pagina + 1)} rel="next">
                  Próxima
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}

/** Le `?pagina=` do endereco: texto de fora, entao qualquer coisa estranha vira 1. */
export function lerPagina(valor: string | undefined): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 1 ? n : 1
}
