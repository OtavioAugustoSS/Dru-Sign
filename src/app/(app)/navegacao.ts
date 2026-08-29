import type { PapelUsuario } from '@/domain/usuarios/tipos'

export interface ItemNavegacao {
  href: string
  titulo: string
  icone: 'fila' | 'producao' | 'ordens' | 'clientes' | 'materiais' | 'operacao' | 'financeiro' | 'plano' | 'usuarios' | 'empresa'
  /** Sem papel: todo mundo ve. */
  papel?: PapelUsuario
}

export const NAVEGACAO: ItemNavegacao[] = [
  // Para quem e da operacao, `/` ja e a fila de producao: um item "Fila de trabalho"
  // levando ao mesmo lugar com outro nome so confunde.
  { href: '/', titulo: 'Fila de trabalho', icone: 'fila', papel: 'administracao' },
  { href: '/producao', titulo: 'Produção', icone: 'producao' },
  { href: '/ordens', titulo: 'Ordens', icone: 'ordens' },
  { href: '/clientes', titulo: 'Clientes', icone: 'clientes' },
  { href: '/materiais', titulo: 'Materiais e preços', icone: 'materiais', papel: 'administracao' },
  { href: '/operacao', titulo: 'Operação', icone: 'operacao', papel: 'administracao' },
  { href: '/financeiro', titulo: 'Financeiro', icone: 'financeiro', papel: 'administracao' },
  { href: '/plano-de-contas', titulo: 'Plano de contas', icone: 'plano', papel: 'administracao' },
  { href: '/usuarios', titulo: 'Usuários', icone: 'usuarios', papel: 'administracao' },
  { href: '/empresa', titulo: 'Dados da empresa', icone: 'empresa', papel: 'administracao' },
]
