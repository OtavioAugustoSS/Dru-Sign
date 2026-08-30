import { test, expect } from '@playwright/test'
import { campoDe, entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

test.describe('Materiais e preços', () => {
  test('administrador cadastra um material e ve o preco formatado', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Materiais e preços' }).click()
    await expect(page).toHaveURL(/\/materiais$/)

    const nome = `ACM 3mm e2e ${Date.now()}`
    await campoDe(page, 'Material').fill(nome)
    await campoDe(page, 'Categoria').fill('Placas')
    await campoDe(page, 'Preço').fill('281,00')
    await campoDe(page, 'Cobrado').selectOption('m2')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const linha = page.getByRole('row', { name: new RegExp(nome) })
    await expect(linha).toContainText('R$ 281,00', { timeout: 30_000 })
    await expect(linha).toContainText('por m²')

    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(page.getByRole('row', { name: new RegExp(nome) })).toContainText('inativo')
  })

  test('erro de validacao nao perde a unidade escolhida no select', async ({ page }) => {
    await entrar(page)
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(`Preco invalido e2e ${Date.now()}`)
    await campoDe(page, 'Preço').fill('abc')
    await campoDe(page, 'Cobrado').selectOption('metro_linear')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Preço inválido' })).toBeVisible({ timeout: 30_000 })
    await expect(campoDe(page, 'Cobrado')).toHaveValue('metro_linear')
  })

  test('operacao nao ve nem abre Materiais e preços', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Materiais e preços' })).toHaveCount(0)
    await page.goto('/materiais')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
  })
})
