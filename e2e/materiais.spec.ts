import { test, expect } from '@playwright/test'
import { entrar } from './apoio'

test.describe('Materiais e preços', () => {
  test('administrador cadastra um material e ve o preco formatado', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Materiais e preços' }).click()
    await expect(page).toHaveURL(/\/materiais$/)

    const nome = `ACM 3mm e2e ${Date.now()}`
    await page.getByLabel('Material').fill(nome)
    await page.getByLabel('Categoria').fill('Placas')
    await page.getByLabel('Preço').fill('281,00')
    await page.getByLabel('Cobrado').selectOption('m2')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const linha = page.getByRole('row', { name: new RegExp(nome) })
    await expect(linha).toContainText('R$ 281,00')
    await expect(linha).toContainText('por m²')

    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(page.getByRole('row', { name: new RegExp(nome) })).toContainText('inativo')
  })
})
