import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: 'fila' | 'ordens' | 'clientes' | 'materiais'
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila' },
  { href: '/ordens', titulo: 'Ordens', icone: 'ordens' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
]
