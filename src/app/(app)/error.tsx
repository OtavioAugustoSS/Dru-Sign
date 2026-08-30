'use client'

import Link from 'next/link'

/**
 * Erro de leitura ou de gravacao, dentro da casca com menu.
 *
 * Duas coisas que a versao anterior nao fazia. A primeira: dizia "o que voce
 * digitou nao foi salvo" mesmo quando a pessoa so estava olhando uma tela --
 * este limite pega falha de leitura tambem, e a frase assustava a toa. A
 * segunda: a unica acao era "Tentar de novo", e ha erro que nao passa por
 * tentar de novo (endereco invalido, registro de outra empresa). Sem uma
 * segunda saida, a pessoa fica batendo no mesmo botao. Agora tem porta.
 */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-body">
      <div className="container-xl">
        <div className="empty">
          <h1 className="empty-title">Não foi possível concluir</h1>
          <p className="empty-subtitle text-secondary">
            A tela não carregou, ou a gravação não terminou. Se você tinha acabado de preencher alguma
            coisa, ela não foi salva.
          </p>
          <div className="empty-action d-flex gap-2 justify-content-center">
            <button type="button" className="btn btn-primary" onClick={() => reset()}>Tentar de novo</button>
            <Link href="/" className="btn btn-link">Fila de trabalho</Link>
          </div>
          {/* O codigo so existe em produção. Em vez de escrever "sem código" e
              ocupar espaço com nada, a linha inteira some quando não há. */}
          {error.digest ? (
            <p className="text-secondary small mt-4 mb-0">
              Se continuar dando errado, avise a administração e passe este código:{' '}
              <code className="fw-bold">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
