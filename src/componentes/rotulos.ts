import type { PapelUsuario } from '@/domain/usuarios/tipos'

/**
 * Texto que aparece em mais de uma tela. Cada constante aqui nasceu de uma
 * divergencia real encontrada na vistoria.
 */

/**
 * O que o botao diz enquanto grava. Havia cinco versoes: "Gravando…",
 * "Salvando…", "Criando…", "…" (so as reticencias, sem dizer nada) e um botao
 * que nao mudava. Para quem usa, e sempre a mesma coisa acontecendo.
 */
export const SALVANDO = 'Salvando…'

/**
 * Trava otimista: alguem mexeu na ordem enquanto esta tela estava aberta. Havia
 * tres redacoes para o mesmo evento.
 */
export const CONFLITO_ORDEM = 'A ordem mudou. Confira os valores e tente de novo.'

/** Quando a propria tela ja se encarrega de recarregar, nao ha o que a pessoa fazer. */
export const CONFLITO_ORDEM_RECARREGANDO = 'A ordem mudou. Recarregando…'

/** O papel da pessoa, em uma palavra. Estava definido em cinco lugares. */
export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  administracao: 'Administração',
  operacao: 'Operação',
}

/** O mesmo papel explicado, para quem esta escolhendo na hora de criar o acesso. */
export const DESCRICAO_PAPEL: Record<PapelUsuario, string> = {
  administracao: 'Administração — vê financeiro, indicadores e configurações',
  operacao: 'Operação — vê a fila de produção e marca serviço finalizado',
}
