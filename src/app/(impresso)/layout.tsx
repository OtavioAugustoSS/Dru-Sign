import { exigirUsuario } from '@/infra/auth/usuario-atual'
import './impresso.css'

/** Sem sidebar: a tela ja e a folha. */
export default async function LayoutImpresso({ children }: { children: React.ReactNode }) {
  await exigirUsuario()
  return <div className="impresso-raiz">{children}</div>
}
