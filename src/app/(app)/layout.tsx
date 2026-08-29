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
      {/* Primeiro elemento focavel da pagina: sem ele, quem navega por teclado
          atravessa 13 links de menu em toda tela para chegar ao conteudo. */}
      <a className="visually-hidden-focusable btn btn-primary pular-conteudo" href="#conteudo">
        Pular para o conteúdo
      </a>
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

      <main className="page-wrapper" id="conteudo" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
