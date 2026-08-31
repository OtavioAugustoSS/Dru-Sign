import Link from 'next/link'

interface Props {
  /** O que se procurava, no singular: "essa ordem", "esse cliente". */
  oQue: string
  /** A lista de onde a pessoa provavelmente veio. */
  href: string
  /** O nome dessa lista, como aparece no menu. */
  rotulo: string
}

/**
 * O endereço existe, o registro não.
 *
 * A saída aponta para a lista DAQUILO que não foi achado. Antes havia um texto
 * só para os quatro casos, e ele mandava para clientes: quem apagava um dígito
 * do endereço de uma ordem era despachado para a carteira de clientes, que não
 * tem nada a ver com o que a pessoa estava fazendo. Errar o endereço de uma
 * ordem quase sempre significa querer outra ordem.
 *
 * "Nesta empresa" fica na frase porque o caso mais comum não é endereço
 * digitado errado: é link de outra loja, e a pessoa precisa saber que o
 * registro pode existir sem ser dela.
 */
export function NaoEncontrado({ oQue, href, rotulo }: Props) {
  return (
    <div className="page-body pagina-recado">
      <div className="container-xl">
        <div className="empty">
          <h1 className="empty-title">Não encontramos {oQue}</h1>
          <p className="empty-subtitle text-secondary">
            O endereço pode estar errado, ou o registro não existe mais nesta empresa.
          </p>
          <div className="empty-action d-flex gap-2 justify-content-center">
            <Link href={href} className="btn btn-primary">{rotulo}</Link>
            <Link href="/" className="btn btn-link">Fila de trabalho</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
