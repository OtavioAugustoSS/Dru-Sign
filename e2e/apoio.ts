import { expect, type Page } from '@playwright/test'

export const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
export const SENHA = process.env.SEED_ADMIN_SENHA ?? ''
export const LOGIN_OPERACAO = process.env.SEED_OPERACAO_LOGIN ?? 'producao'
export const SENHA_OPERACAO = process.env.SEED_OPERACAO_SENHA ?? ''

export async function entrarComo(page: Page, login: string, senha: string): Promise<void> {
  if (senha === '') throw new Error(`Senha ausente em .env.local para o login "${login}" — rode o seed antes`)
  await page.goto('/entrar')
  await page.getByLabel('Login').fill(login)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Entra como o administrador do seed. */
export async function entrar(page: Page): Promise<void> {
  await entrarComo(page, LOGIN, SENHA)
}
