'use client'

/** Erro de gravacao ou de leitura: explica o que houve, oferece tentar de novo, nao perde a tela. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-body">
      <div className="container-xl">
        <div className="empty">
          <h1 className="empty-title">Não foi possível concluir</h1>
          <p className="empty-subtitle text-secondary">
            Algo falhou ao gravar ou ler os dados. O que você digitou não foi salvo. Tente de novo; se continuar,
            avise a administração e informe este código: <code>{error.digest ?? 'sem código'}</code>.
          </p>
          <div className="empty-action">
            <button type="button" className="btn btn-primary" onClick={() => reset()}>Tentar de novo</button>
          </div>
        </div>
      </div>
    </div>
  )
}
