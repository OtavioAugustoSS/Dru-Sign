import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: 'fila' | 'clientes' | 'materiais'
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
]
