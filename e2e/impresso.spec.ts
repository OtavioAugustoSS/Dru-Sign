import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { entrar } from './apoio'

test.describe('Impresso da ordem', () => {
  test('mostra numero, itens e total; some a barra em print; gera PDF A4', async ({ page, browserName, headless }) => {
    await entrar(page)
    await page.goto('/ordens/nova')
    await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
    const campo = page.getByLabel('Lançar item ou acréscimo')
    for (const linha of ['12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00', '+instalacao 280']) {
      await campo.fill(linha); await campo.press('Enter'); await expect(campo).toHaveValue('', { timeout: 30_000 })
    }
    const numero = (await page.getByRole('heading', { name: /nº (\d{6})/ }).textContent())?.match(/(\d{6})/)?.[1]

    await page.getByRole('link', { name: 'Imprimir' }).click()
    await expect(page).toHaveURL(/\/impresso$/, { timeout: 60_000 })
    const via = page.getByRole('article', { name: /Via do cliente/ })
    await expect(via).toBeVisible()
    await expect(via).toContainText(`Nº ${numero}`)
    await expect(via).toContainText('Venda de balcão')
    await expect(via.locator('.itens tbody tr')).toHaveCount(1)
    await expect(via.locator('.itens tbody tr').first()).toContainText('por unidade')
    await expect(via.locator('.itens tbody tr').first()).toContainText('0,61 × 0,40 m')
    await expect(via).toContainText('Instalação')
    await expect(via.locator('.valores .total')).toContainText('R$ 1.012,00')
    await expect(via.getByText('Sempre guarde esse comprovante como sua garantia de entrega!')).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
    await page.emulateMedia({ media: null })

    await page.goto(`${page.url()}?vias=2`)
    await expect(page.getByRole('article', { name: /Via da loja/ })).toBeVisible()

    test.skip(browserName !== 'chromium' || !headless, 'page.pdf exige Chromium headless')
    await page.evaluate(() => document.fonts.ready)
    await mkdir('test-results', { recursive: true })
    const pdf = await page.pdf({ path: `test-results/impresso-os-${numero}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(10_000)
  })
})
