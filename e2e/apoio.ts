import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Campo de formulario pelo rotulo.
 *
 * `getByLabel` casa com o `<label>` E com o `aria-label` de qualquer elemento --
 * e as tabelas do sistema tem um, para quem usa leitor de tela saber o que a
 * tabela lista. Ai "Materiais e preços" passou a casar com `getByLabel('Preço')`
 * junto com o campo, e o teste morria em strict mode. O rotulo da tabela e bom e
 * fica; o que estava impreciso era a busca. Aqui ela pede as duas coisas: o
 * rotulo certo E ser um controle de formulario.
 */
export function campoDe(onde: Page | Locator, rotulo: string | RegExp, opcoes?: { exact?: boolean }): Locator {
  return onde.getByLabel(rotulo, opcoes).and(onde.locator('input, select, textarea'))
}

export const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
export const SENHA = process.env.SEED_ADMIN_SENHA ?? ''
export const LOGIN_OPERACAO = process.env.SEED_OPERACAO_LOGIN ?? 'producao'
export const SENHA_OPERACAO = process.env.SEED_OPERACAO_SENHA ?? ''

export async function entrarComo(page: Page, login: string, senha: string): Promise<void> {
  if (senha === '') throw new Error(`Senha ausente em .env.local para o login "${login}" — rode o seed antes`)
  await page.goto('/entrar')
  await campoDe(page, 'Login').fill(login)
  await campoDe(page, 'Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Entra como o administrador do seed. */
export async function entrar(page: Page): Promise<void> {
  await entrarComo(page, LOGIN, SENHA)
}
