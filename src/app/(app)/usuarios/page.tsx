import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarUsuarios } from '@/infra/usuarios/repositorio'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { FormUsuario } from './form-usuario'
import { AcoesUsuario } from './acoes-usuario'

export const metadata: Metadata = { title: 'Usuários' }

const ROTULO_PAPEL = { administracao: 'Administração', operacao: 'Operação' } as const

export default async function PaginaUsuarios() {
  const usuario = await exigirPapel('administracao')
  const usuarios = await listarUsuarios(usuario.empresaId)

  return (
    <>
      <CabecalhoPagina pretitulo="Administração" titulo="Usuários" />
      <CorpoPagina>
        <div className="card mb-3"><div className="card-body"><FormUsuario /></div></div>
        <CartaoTabela
          rotulo="Usuários"
          colunas={
            <>
              <th>Nome</th>
              <th>Login</th>
              <th>Papel</th>
              <th>Desde</th>
              <th className="w-1"></th>
            </>
          }
        >
          {usuarios.map((u) => (
            <tr key={u.id} className={u.ativo ? '' : 'text-secondary'}>
              <td>{u.nome}{u.ativo ? null : <span className="badge bg-secondary-lt ms-2">desativado</span>}{u.id === usuario.id ? <span className="badge bg-primary-lt ms-2">você</span> : null}</td>
              <td>{u.login}</td>
              <td>{ROTULO_PAPEL[u.papel]}</td>
              <td className="text-secondary">{formatarDataCalendario(new Date(u.criadoEm))}</td>
              <td><AcoesUsuario id={u.id} nome={u.nome} papel={u.papel} ativo={u.ativo} euMesmo={u.id === usuario.id} /></td>
            </tr>
          ))}
        </CartaoTabela>
        <p className="text-secondary small mt-2">Usuário nunca é apagado: ele é o responsável de ordens antigas. Desativar tira o acesso e preserva a história.</p>
      </CorpoPagina>
    </>
  )
}
