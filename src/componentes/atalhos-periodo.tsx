import Link from 'next/link'
import { atalhoAtivo, type Periodo } from './periodos'

interface Props {
  periodos: Periodo[]
  de: string
  ate: string
  base: string
  /** Os outros filtros da tela, para o atalho nao apagar o que ja estava escolhido. */
  parametros?: Record<string, string | undefined>
}

/**
 * "Hoje · 7 dias · Este mes · Mes passado · Este ano" acima dos campos de data.
 *
 * Sao links, e nao botoes: o periodo mora no endereco, entao o mes passado vira
 * um link que da para guardar. E o atalho em vigor fica marcado -- sem isso a
 * pessoa nao sabe se esta vendo o mes ou os ultimos trinta dias.
 *
 * Trocar de periodo volta para a primeira pagina, omitindo `pagina`: a pagina 4
 * de agosto nao e a pagina 4 do ano.
 */
export function AtalhosPeriodo({ periodos, de, ate, base, parametros = {} }: Props) {
  const ativo = atalhoAtivo(periodos, de, ate)
  return (
    <div className="d-flex flex-wrap align-items-center gap-1" role="group" aria-label="Períodos">
      {periodos.map((p) => {
        const busca = new URLSearchParams()
        for (const [k, v] of Object.entries(parametros)) if (v) busca.set(k, v)
        busca.set('de', p.de)
        busca.set('ate', p.ate)
        const marcado = ativo === p.chave
        return (
          <Link
            key={p.chave}
            href={`${base}?${busca.toString()}`}
            className={marcado ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
            aria-current={marcado ? 'true' : undefined}
          >
            {p.rotulo}
          </Link>
        )
      })}
    </div>
  )
}
