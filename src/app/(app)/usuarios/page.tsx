import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarUsuarios } from '@/infra/usuarios/repositorio'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { Anotacao } from '@/componentes/situacao'
import { ROTULO_PAPEL } from '@/componentes/rotulos'
import { FormUsuario } from './form-usuario'
import { AcoesUsuario } from './acoes-usuario'

export const metadata: Metadata = { title: 'Usuários' }

export default async function PaginaUsuarios() {
  const usuario = await exigirPapel('administracao')
  const usuarios = await listarUsuarios(usuario.empresaId)

  return (
    <>
      <CabecalhoPagina
        pretitulo="Configuração"
        titulo="Usuários"
        descricao="Quem entra no sistema e o que cada um enxerga. Operação vê a fila de produção e marca serviço pronto; administração vê também o dinheiro e a configuração."
      />
      <CorpoPagina>
        {/* Cabecalho no cartao de criacao, como em Materiais e no Plano de contas:
            sem ele o formulario aparecia solto no topo, sem dizer o que cria. */}
        <div className="card mb-3">
          <div className="card-header"><h2 className="card-title">Novo usuário</h2></div>
          <div className="card-body"><FormUsuario /></div>
        </div>
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
              <td>{u.nome}{u.ativo ? null : <Anotacao>desativado</Anotacao>}{u.id === usuario.id ? <Anotacao tom="marca">você</Anotacao> : null}</td>
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
