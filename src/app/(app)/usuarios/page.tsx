import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarUsuarios } from '@/infra/usuarios/repositorio'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { FormUsuario } from './form-usuario'
import { AcoesUsuario } from './acoes-usuario'

export const metadata: Metadata = { title: 'Usuários' }

const ROTULO_PAPEL = { administracao: 'Administração', operacao: 'Operação' } as const

export default async function PaginaUsuarios() {
  const usuario = await exigirPapel('administracao')
  const usuarios = await listarUsuarios(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl">
        <div className="page-pretitle">Administração</div>
        <h2 className="page-title">Usuários</h2>
      </div></div>
      <div className="page-body"><div className="container-xl">
        <div className="card mb-3"><div className="card-body"><FormUsuario /></div></div>
        <div className="card"><div className="table-responsive">
          <table className="table table-vcenter card-table" aria-label="Usuários">
            <thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Desde</th><th className="w-1"></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'text-secondary'}>
                  <td>{u.nome}{u.ativo ? null : <span className="badge bg-secondary-lt ms-2">desativado</span>}{u.id === usuario.id ? <span className="badge bg-primary-lt ms-2">você</span> : null}</td>
                  <td>{u.login}</td>
                  <td>{ROTULO_PAPEL[u.papel]}</td>
                  <td className="text-secondary">{formatarDataCalendario(new Date(u.criadoEm))}</td>
                  <td><AcoesUsuario id={u.id} nome={u.nome} papel={u.papel} ativo={u.ativo} euMesmo={u.id === usuario.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
        <p className="text-secondary small mt-2">Usuário nunca é apagado: ele é o responsável de ordens antigas. Desativar tira o acesso e preserva a história.</p>
      </div></div>
    </>
  )
}
