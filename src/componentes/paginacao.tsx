import Link from 'next/link'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { MarcaPendente } from './pendente'

/** Quantas linhas cabem numa tela sem virar rolagem infinita. */
export const POR_PAGINA = 50

/**
 * Para listas cuja linha carrega um bloco de texto.
 *
 * No historico do sistema antigo cada linha traz ate sete campos de observacao
 * concatenados: a linha mediana tem 82px, e cinquenta delas davam uma pagina de
 * 5.400px. Com vinte e cinco a pagina cabe em tres telas -- e quem procura algo
 * especifico usa a busca, nao a pagina 47.
 */
export const POR_PAGINA_TEXTO = 25

interface Base {
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

function contas({ pagina, porPagina, total, base, parametros }: Base) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const endereco = (p: number) => {
    const busca = new URLSearchParams()
    for (const [chave, valor] of Object.entries(parametros)) {
      if (valor) busca.set(chave, valor)
    }
    if (p > 1) busca.set('pagina', String(p))
    const texto = busca.toString()
    return texto ? `${base}?${texto}` : base
  }
  return {
    paginas,
    endereco,
    primeiro: total === 0 ? 0 : (pagina - 1) * porPagina + 1,
    ultimo: Math.min(pagina * porPagina, total),
    temAnterior: pagina > 1,
    temProxima: pagina < paginas,
  }
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
export function Paginacao(p: Base) {
  const { paginas, endereco, primeiro, ultimo, temAnterior, temProxima } = contas(p)

  // Sem `card-footer` aqui: quem embrulha e o CartaoTabela, e dois rodapes
  // aninhados dariam duas bordas e dois espacamentos.
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <p className="m-0 text-secondary">
        Mostrando <strong>{primeiro}</strong> a <strong>{ultimo}</strong> de <strong>{p.total}</strong>
      </p>
      {paginas <= 1 ? null : (
        <nav aria-label="Páginas">
          <ul className="pagination m-0">
            <li className={temAnterior ? 'page-item' : 'page-item disabled'}>
              {temAnterior ? (
                <Link className="page-link" href={endereco(p.pagina - 1)} rel="prev">
                  Anterior
                  <MarcaPendente classe="marca-pendente" />
                </Link>
              ) : (
                <span className="page-link" aria-disabled="true">Anterior</span>
              )}
            </li>
            <li className="page-item disabled">
              <span className="page-link" aria-current="page">Página {p.pagina} de {paginas}</span>
            </li>
            <li className={temProxima ? 'page-item' : 'page-item disabled'}>
              {temProxima ? (
                <Link className="page-link" href={endereco(p.pagina + 1)} rel="next">
                  Próxima
                  <MarcaPendente classe="marca-pendente" />
                </Link>
              ) : (
                <span className="page-link" aria-disabled="true">Próxima</span>
              )}
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}

/**
 * A mesma navegacao, no CABECALHO do cartao.
 *
 * Existe porque cinquenta linhas dao uma pagina de 2.700px, e a lista do
 * historico chega a 5.400px: a paginacao no rodape ficava a cinco telas de
 * rolagem do topo, e quem abria a tela concluia -- com razao -- que ela nao
 * tinha paginacao nenhuma. Agora a virada de pagina esta onde o olho ja esta
 * quando decide virar, e o rodape continua para quem leu a lista inteira.
 *
 * So setas e "3 / 25": e um duplicado do rodape, e duplicado que grita compete
 * com o titulo do cartao.
 */
export function PaginacaoCompacta(p: Base) {
  const { paginas, endereco, temAnterior, temProxima } = contas(p)
  if (paginas <= 1) return null
  return (
    <nav aria-label="Páginas" className="d-inline-flex align-items-center gap-1">
      {temAnterior ? (
        <Link className="btn btn-sm btn-ghost-secondary btn-icon" href={endereco(p.pagina - 1)} rel="prev" aria-label="Página anterior">
          <IconChevronLeft className="icon" />
          <MarcaPendente classe="marca-pendente" />
        </Link>
      ) : (
        <span className="btn btn-sm btn-ghost-secondary btn-icon disabled" aria-hidden="true"><IconChevronLeft className="icon" /></span>
      )}
      <span className="text-secondary small numero">{p.pagina} / {paginas}</span>
      {temProxima ? (
        <Link className="btn btn-sm btn-ghost-secondary btn-icon" href={endereco(p.pagina + 1)} rel="next" aria-label="Próxima página">
          <IconChevronRight className="icon" />
          <MarcaPendente classe="marca-pendente" />
        </Link>
      ) : (
        <span className="btn btn-sm btn-ghost-secondary btn-icon disabled" aria-hidden="true"><IconChevronRight className="icon" /></span>
      )}
    </nav>
  )
}

/** Le `?pagina=` do endereco: texto de fora, entao qualquer coisa estranha vira 1. */
export function lerPagina(valor: string | undefined): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 1 ? n : 1
}
