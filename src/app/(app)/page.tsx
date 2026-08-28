import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'

export const metadata: Metadata = { title: 'Fila de trabalho' }

export default async function PaginaFila() {
  const usuario = await exigirUsuario()

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Fila de trabalho</h2>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-body">
              <div className="empty">
                <p className="empty-title">Ainda não há ordens de serviço</p>
                <p className="empty-subtitle text-secondary">
                  Olá, {usuario.nome}. Aqui vão aparecer as ordens abertas há mais de uma semana e as
                  concluídas que ainda não foram pagas. A fila ganha vida na Fase 4, quando ordens e
                  recebimentos existirem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
