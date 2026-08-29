import Link from 'next/link'

/**
 * Endereco que nao corresponde a rota nenhuma.
 *
 * Diferente do `not-found` de dentro do app: aquele responde a `notFound()`, num
 * cadastro que nao existe, e roda dentro da casca com menu. Este responde a uma
 * URL digitada errada, quando nem sabemos se ha alguem logado -- entao traz a
 * propria casca, sem menu e sem consultar o banco.
 */
export default function NaoEncontradoRaiz() {
  return (
    <div className="page page-center">
      <main className="container container-tight py-4">
        <div className="empty">
          <h1 className="empty-title">Esta página não existe</h1>
          <p className="empty-subtitle text-secondary">
            O endereço digitado não corresponde a nenhuma tela do sistema. Pode ter vindo de um link
            antigo ou de um erro de digitação.
          </p>
          <div className="empty-action">
            <Link href="/" className="btn btn-primary">
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
