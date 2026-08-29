import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: 'fila' | 'ordens' | 'clientes' | 'materiais' | 'financeiro' | 'plano'
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila' },
  { href: '/ordens', titulo: 'Ordens', icone: 'ordens' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
  { href: '/financeiro', titulo: 'Financeiro', icone: 'financeiro', papel: 'administracao' },
  { href: '/plano-de-contas', titulo: 'Plano de contas', icone: 'plano', papel: 'administracao' },
]
