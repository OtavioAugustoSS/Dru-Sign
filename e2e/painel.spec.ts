import { test, expect } from '@playwright/test'
import { campoDe, entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

test.describe('Painel', () => {
  test('mostra o dinheiro do periodo, e cada numero leva a tela onde o dado mora', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Painel', exact: true }).click()
    await expect(page).toHaveURL(/\/painel$/)

    for (const t of ['faturado', 'recebido', 'saidas-painel', 'saldo-painel', 'a-receber']) {
      await expect(page.getByTestId(t)).toContainText(/R\$|\d/)
    }

    // O pedido era "todos os dados clicaveis": o cartao de saidas abre o
    // livro-caixa ja filtrado no periodo e no tipo, e nao a tela crua.
    await page.getByTestId('saidas-painel').click()
    await expect(page).toHaveURL(/\/financeiro\?de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}&tipo=saida/)
    await expect(page.getByLabel('Tipo')).toHaveValue('saida')
  })

  test('as duas eras ficam em abas, e a barra do ano abre o historico daquele ano', async ({ page }) => {
    await entrar(page)
    await page.goto('/painel')
    // O sistema novo tem semanas de dados; o arquivo tem 14 anos. Juntos no
    // mesmo eixo, o novo viraria um risco no chao do grafico.
    await page.getByRole('link', { name: 'Arquivo antigo' }).click()
    await expect(page).toHaveURL(/serie=arquivo/)

    const grafico = page.getByRole('group', { name: /sistema antigo/i })
    const barras = grafico.getByRole('link')
    if (await barras.count() === 0) return // sem importacao rodada

    await expect(barras.first()).toHaveAttribute('href', /\/historico\?aba=antigo&de=\d{4}-01-01/)
    await barras.last().click()
    await expect(page).toHaveURL(/\/historico\?aba=antigo/)
    await expect(page.getByRole('heading', { name: 'Histórico', exact: true })).toBeVisible()
  })

  test('o atalho de periodo troca os numeros e continua marcado', async ({ page }) => {
    await entrar(page)
    await page.goto('/painel')
    await page.getByRole('link', { name: 'Ano passado' }).click()
    await expect(page.getByRole('link', { name: 'Ano passado' })).toHaveAttribute('aria-current', 'true')
    await expect(campoDe(page, 'De')).toHaveValue(/\d{4}-01-01/)
    await expect(campoDe(page, 'Até')).toHaveValue(/\d{4}-12-31/)
  })

  test('operacao nao ve nem abre o painel', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Painel', exact: true })).toHaveCount(0)
    await page.goto('/painel')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
  })
})
