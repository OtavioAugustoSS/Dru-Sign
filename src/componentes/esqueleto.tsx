import { CorpoPagina } from './corpo-pagina'

/**
 * O contorno da tela enquanto o banco responde.
 *
 * Nao e roda-roda no meio da tela: e o formato do que vai chegar. A pessoa ja ve
 * que ali vai ter uma tabela, e o conteudo nao pula quando aparece.
 *
 * Existe UM esqueleto para o app inteiro, em `(app)/loading.tsx`, e nao um por
 * tela. O motivo esta medido: o layout do grupo tambem e assincrono (le a sessao
 * e o tema), entao no carregamento de uma URL o limite do grupo e o primeiro a
 * ficar pendente e e o dele que aparece -- um `loading.tsx` por rota nunca
 * chegava a ser desenhado. E na navegacao pelo menu o Next ja pre-carregou a
 * rota, entao nao ha espera nenhuma. Cartao+tabela e a forma de 11 das 14 telas.
 *
 * As larguras variam por posicao, nunca por sorteio: valor sorteado no servidor
 * difere do sorteado no navegador e a hidratacao reclama.
 */

/** Larguras que se repetem em ciclo, para a linha parecer dado e nao grade. */
const LARGURAS = ['w-75', 'w-50', 'w-100', 'w-50', 'w-75', 'w-25']

function barra(indice: number, extra?: string) {
  const largura = LARGURAS[indice % LARGURAS.length]
  return <span className={`placeholder ${largura}${extra ? ` ${extra}` : ''}`} />
}

interface Props {
  /** Quantas linhas de tabela desenhar. */
  linhas?: number
  /** Quantas colunas por linha. */
  colunas?: number
  /** Desenha o botao do canto direito do cabecalho. */
  comAcao?: boolean
  /** Desenha a faixa de filtro acima da tabela. */
  comFiltro?: boolean
}

export function EsqueletoTabela({ linhas = 8, colunas = 5, comAcao, comFiltro }: Props) {
  return (
    <div className="placeholder-glow" role="status" aria-live="polite">
      <span className="visually-hidden">Carregando…</span>

      <div className="page-header d-print-none" aria-hidden="true">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <span className="placeholder placeholder-xs w-25 d-block mb-2" />
              <span className="placeholder placeholder-lg w-50 d-block" />
            </div>
            {comAcao ? (
              <div className="col-auto col-sm-3 col-lg-2">
                {/* `.placeholder.btn` e o proprio padrao do Bootstrap para botao
                    em espera: mantem a altura de botao sem estilo inline. */}
                <span className="btn btn-primary disabled placeholder w-100" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <CorpoPagina>
        {comFiltro ? (
          <div className="card mb-3" aria-hidden="true">
            <div className="card-body row g-2">
              <div className="col-md-3">{barra(0, 'd-block')}</div>
              <div className="col-md-3">{barra(1, 'd-block')}</div>
              <div className="col-md-2">{barra(2, 'd-block')}</div>
            </div>
          </div>
        ) : null}

        <div className="card" aria-hidden="true">
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  {Array.from({ length: colunas }, (_, c) => (
                    <th key={c}>{barra(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: linhas }, (_, l) => (
                  <tr key={l}>
                    {Array.from({ length: colunas }, (_, c) => (
                      <td key={c}>{barra(l + c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CorpoPagina>
    </div>
  )
}
