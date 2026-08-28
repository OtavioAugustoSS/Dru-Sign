import { test, expect } from '@playwright/test'

// Credenciais do seed (npm run db:seed), lidas de .env.local pelo playwright.config.ts.
const LOGIN = process.env.SEED_ADMIN_LOGIN ?? 'admin'
const SENHA = process.env.SEED_ADMIN_SENHA ?? ''

test.beforeAll(() => {
  if (SENHA === '') throw new Error('SEED_ADMIN_SENHA ausente em .env.local — rode `npm run db:seed` antes')
})

test.describe('Entrar', () => {
  test('rota protegida sem sessao redireciona para /entrar', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar\?proximo=%2F$/)
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('senha errada mostra erro e permanece em /entrar', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Login').fill(LOGIN)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    // O next dev injeta um role="alert" proprio (route announcer): filtrar pelo texto.
    await expect(page.getByRole('alert').filter({ hasText: 'Login ou senha inválidos' })).toBeVisible()
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('entra, chega na fila de trabalho e sai', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Login').fill(LOGIN)
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de trabalho' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()

    // Ja logado, /entrar volta para a home (validado no banco, nao so pelo cookie).
    await page.goto('/entrar')
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole('button', { name: 'Abrir menu do usuário' }).click()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/entrar/)

    // A sessao foi apagada no banco: a home volta a exigir login.
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar/)
  })
})
