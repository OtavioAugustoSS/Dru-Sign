import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CascaLateral } from '@/componentes/casca-lateral'
import { MenuUsuario } from '@/componentes/menu-usuario'
import { ROTULO_PAPEL } from '@/componentes/rotulos'
import { sair } from '@/app/(auth)/entrar/actions'
import { escolherTema } from '@/app/acoes-tema'
import { lerTemaDoCookie } from '@/infra/tema/cookie'
import { navegacaoPara } from './navegacao'

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const [usuario, tema] = await Promise.all([exigirUsuario(), lerTemaDoCookie()])

  return (
    <div className="page">
      <CascaLateral
        itens={navegacaoPara(usuario.papel)}
        menuUsuario={
          <MenuUsuario
            nome={usuario.nome}
            papel={ROTULO_PAPEL[usuario.papel]}
            iniciais={iniciais(usuario.nome)}
            tema={tema}
            sairAction={sair}
            escolherTemaAction={escolherTema}
          />
        }
      />

      <div className="page-wrapper">{children}</div>
    </div>
  )
}
