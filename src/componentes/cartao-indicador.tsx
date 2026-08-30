import type { ReactNode } from 'react'
import { TEXTO, type Tom } from './situacao'

interface Props {
  /** O que o numero mede, em duas ou tres palavras. */
  rotulo: string
  /** O numero. Grande, porque e o que se le de relance. */
  valor: ReactNode
  /** O alvo, a comparação com o legado, a explicacao. Fica embaixo, em letra menor. */
  nota?: ReactNode
  /** Colore o valor quando ele diz alguma coisa: fora do alvo, dentro do alvo. */
  tom?: Tom
  /** So onde o teste de ponta a ponta ja depende do valor. */
  testId?: string
}

/**
 * Um numero com nome e contexto.
 *
 * Existe porque tres telas desenhavam a mesma coisa a mao e nenhuma igual. Na
 * carteira, o primeiro cartao nao tinha legenda e os outros tres tinham: como a
 * altura vinha do conteudo, a fileira inteira ficava desalinhada. Aqui o `h-100`
 * resolve isso de uma vez -- todos os cartoes da fileira tem a mesma altura,
 * tenham nota ou nao.
 */
export function CartaoIndicador({ rotulo, valor, nota, tom, testId }: Props) {
  return (
    <div className="card card-sm h-100">
      <div className="card-body">
        <div className="subheader">{rotulo}</div>
        <div className={`h2 mb-0 digitos${tom ? ` ${TEXTO[tom]}` : ''}`} data-testid={testId}>
          {valor}
        </div>
        {nota ? <div className="text-secondary small mt-1">{nota}</div> : null}
      </div>
    </div>
  )
}
