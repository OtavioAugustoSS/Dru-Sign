import { expect, type Page } from '@playwright/test'

export const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
export const SENHA = process.env.SEED_ADMIN_SENHA ?? ''

export async function entrar(page: Page): Promise<void> {
  if (SENHA === '') throw new Error('SEED_ADMIN_SENHA ausente em .env.local')
  await page.goto('/entrar')
  await page.getByLabel('Login').fill(LOGIN)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}
