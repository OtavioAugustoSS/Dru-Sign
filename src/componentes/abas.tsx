import Link from 'next/link'

export interface Aba {
  /** O valor que vai no endereço. */
  valor: string
  rotulo: string
  /** Quantos itens a aba tem, ao lado do nome. Ajuda a decidir qual abrir. */
  contagem?: number
}

interface Props {
  abas: Aba[]
  atual: string
  base: string
  /** O nome do parâmetro no endereço. */
  parametro?: string
  /**
   * Os outros parâmetros da tela. Trocar de aba não deve apagar a busca, mas
   * DEVE voltar para a primeira página: a página 7 da aba antiga não é a
   * página 7 da nova, e cair numa página vazia parece tela quebrada.
   */
  parametros?: Record<string, string | undefined>
  /** Para o leitor de tela saber o que estas abas dividem. */
  rotulo: string
}

/**
 * Abas que trocam pelo endereço, sem JavaScript no navegador.
 *
 * Cada aba é um link, então a aba escolhida sobrevive ao recarregar, pode ir
 * para os favoritos e ser mandada para outra pessoa. É o mesmo raciocínio das
 * colunas que ordenam: estado que a pessoa escolhe e quer manter mora no
 * endereço, não na memória do navegador.
 */
export function Abas({ abas, atual, base, parametro = 'aba', parametros = {}, rotulo }: Props) {
  return (
    <ul className="nav nav-tabs mb-3" aria-label={rotulo}>
      {abas.map((a) => {
        const busca = new URLSearchParams()
        for (const [k, v] of Object.entries(parametros)) if (v) busca.set(k, v)
        busca.set(parametro, a.valor)
        const ativa = a.valor === atual
        return (
          <li className="nav-item" key={a.valor}>
            <Link
              href={`${base}?${busca.toString()}`}
              className={ativa ? 'nav-link active' : 'nav-link'}
              aria-current={ativa ? 'page' : undefined}
            >
              {a.rotulo}
              {a.contagem !== undefined ? (
                <span className="anotacao">{a.contagem.toLocaleString('pt-BR')}</span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
