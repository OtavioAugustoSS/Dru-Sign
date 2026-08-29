import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterEmpresa } from '@/infra/empresa/repositorio'
import { FormEmpresa } from './form-empresa'

export const metadata: Metadata = { title: 'Dados da empresa' }

export default async function PaginaEmpresa() {
  const usuario = await exigirPapel('administracao')
  const empresa = await obterEmpresa(usuario.empresaId)
  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h2 className="page-title">Dados da empresa</h2>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <FormEmpresa empresa={empresa} />
        <p className="text-secondary small mt-2">
          O logo entra junto com o anexo de arte, na próxima fase. Para conferir como ficou o cabeçalho,
          abra qualquer ordem e clique em <Link href="/ordens">Imprimir</Link>.
        </p>
      </div></div>
    </>
  )
}
