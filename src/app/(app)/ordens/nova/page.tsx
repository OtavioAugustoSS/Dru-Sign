import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { criarOrdemAction } from './actions'

export const metadata: Metadata = { title: 'Nova ordem' }

/** A chave nasce no render do servidor: reenviar o mesmo formulario reaproveita a chave e nao cria duas ordens. */
export default async function PaginaNovaOrdem() {
  await exigirUsuario()
  const chave = randomUUID()
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="page-pretitle">Atendimento</div>
          <h1 className="page-title">Nova ordem</h1>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <p className="text-secondary">
                O que o cliente quer: uma ordem de serviço para produzir agora, ou um orçamento para ele decidir depois.
                Aprovar o orçamento não recria nada — só muda o estado e trava o preço.
              </p>
              <form action={criarOrdemAction} className="d-flex gap-2">
                <input type="hidden" name="chave" value={chave} />
                <button type="submit" name="estado" value="aberta" className="btn btn-primary" autoFocus>Ordem de serviço</button>
                <button type="submit" name="estado" value="orcamento" className="btn">Orçamento</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
