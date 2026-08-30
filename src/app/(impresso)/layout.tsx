import { exigirUsuario } from '@/infra/auth/usuario-atual'
import './impresso.css'

/**
 * Sem sidebar: a tela ja e a folha.
 *
 * `data-bs-theme="light"` de proposito. A folha e branca com tinta preta em
 * qualquer tema -- o CSS do impresso usa cor fixa, nao variavel do tema -- mas
 * os tres botoes de cima sao do Bootstrap e seguiam o tema escuro: ficavam
 * escuros sobre a mesa cinza-clara da folha, e o de "vias" media 2,14:1, que
 * reprova. Travar o tema aqui alinha os botoes ao papel que eles servem, numa
 * linha, em vez de corrigir cada botao.
 */
export default async function LayoutImpresso({ children }: { children: React.ReactNode }) {
  await exigirUsuario()
  return <main className="impresso-raiz" data-bs-theme="light">{children}</main>
}
