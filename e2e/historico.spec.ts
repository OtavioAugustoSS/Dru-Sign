import { test, expect } from '@playwright/test'
import { campoDe, entrar } from './apoio'

test.describe('Histórico', () => {
  test('busca no arquivo do sistema antigo por numero, cliente e texto', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Histórico' }).click()
    await expect(page).toHaveURL(/\/historico$/)
    await expect(page.getByRole('heading', { name: 'Histórico do sistema antigo' })).toBeVisible()

    const tabela = page.getByRole('table', { name: 'Ordens do sistema antigo' })
    if (await tabela.count() === 0) {
      // Sem importacao rodada, o estado vazio precisa ensinar o que fazer.
      await expect(page.getByText('npm run importar:ordens')).toBeVisible()
      return
    }
    await expect(page.getByTestId('soma-historico')).toContainText('R$')
    await campoDe(page, 'Buscar').fill('18449')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(tabela.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })
    await page.getByRole('link', { name: 'Limpar' }).click()
    await campoDe(page, 'Buscar').fill('zzz nao existe zzz')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByText('Nada no arquivo com esse filtro')).toBeVisible({ timeout: 30_000 })
  })

  test('relatorio do contador soma por conta e baixa CSV', async ({ page }) => {
    await entrar(page)
    await page.goto('/financeiro/contador')
    await expect(page.getByRole('heading', { name: 'Relatório para o contador' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Entradas por conta' })).toBeVisible()
    await expect(page.getByTestId('saldo')).toContainText('R$')

    const resposta = await page.request.get('/financeiro/contador/csv?de=2026-08-01&ate=2026-08-31')
    expect(resposta.status()).toBe(200)
    expect(resposta.headers()['content-type']).toContain('text/csv')
    const texto = await resposta.text()
    expect(texto).toContain('Periodo;01/08/2026;31/08/2026')
    expect(texto).toContain('Tipo;Codigo;Conta;Lancamentos;Total')
    expect(texto).toContain('Saldo;;;;')
  })
})
