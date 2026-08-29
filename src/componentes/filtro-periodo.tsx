import type { ReactNode } from 'react'

interface Props {
  de: string
  ate: string
  /** Rotulo da primeira data. "Aberta de" em telas de ordem, "De" no dinheiro. */
  rotuloDe?: string
  rotuloAte?: string
  rotuloBotao?: string
  /** Mensagem quando a data digitada nao serve, ja com o que o sistema fez no lugar. */
  erro?: string | null
  /** Link secundario dentro do filtro, quando a tela tem um destino irmao. */
  aoLado?: ReactNode
  /** Legenda abaixo dos campos, explicando o periodo que esta valendo. */
  nota?: ReactNode
}

/**
 * O filtro de periodo das telas de dinheiro e de indicadores. Estava repetido em
 * cinco telas, com rotulos que divergiram entre "De"/"Ate" e "Aberta de"/"ate".
 *
 * E um `<form method="get">` sem JavaScript: o periodo vira endereco, entao a
 * pessoa pode guardar o link do mes que ela sempre confere.
 */
export function FiltroPeriodo({
  de,
  ate,
  rotuloDe = 'De',
  rotuloAte = 'Até',
  rotuloBotao = 'Mostrar',
  erro,
  aoLado,
  nota,
}: Props) {
  return (
    <form method="get" className="card mb-3">
      <div className="card-body row g-2 align-items-end">
        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="de">
            {rotuloDe}
          </label>
          <input id="de" type="date" name="de" className="form-control" defaultValue={de} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="ate">
            {rotuloAte}
          </label>
          <input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary">
            {rotuloBotao}
          </button>
        </div>
        {aoLado ? <div className="col-auto">{aoLado}</div> : null}
        {erro ? (
          <div className="col-12 text-danger small" role="alert">
            {erro}
          </div>
        ) : null}
        {nota ? <div className="col-12 form-hint">{nota}</div> : null}
      </div>
    </form>
  )
}
