import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <div className="page-body">
      <div className="container-xl">
        <div className="empty">
          <p className="empty-title">Não encontramos esse cadastro</p>
          <p className="empty-subtitle text-secondary">
            O endereço pode estar errado, ou o registro não existe mais nesta empresa.
          </p>
          <div className="empty-action d-flex gap-2 justify-content-center">
            <Link href="/clientes" className="btn btn-primary">Ir para clientes</Link>
            <Link href="/" className="btn btn-link">Fila de trabalho</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
