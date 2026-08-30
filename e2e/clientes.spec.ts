import { test, expect } from '@playwright/test'
import { campoDe, entrar } from './apoio'

// Pressupoe `npm run importar:clientes` ja executado no banco de desenvolvimento.
test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page)
  })

  test('a busca por apelido acha o Bretas e a FACTU', async ({ page }) => {
    await page.goto('/clientes?q=bretas')
    await expect(page.getByRole('link', { name: 'CENCOSUD BRASIL COMERCIAL' })).toBeVisible()

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('factu')
    await page.getByRole('searchbox', { name: 'Buscar' }).press('Enter')
    await expect(page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
  })

  test('a busca por telefone acha pelo numero completado', async ({ page }) => {
    await page.goto('/clientes?q=38999681168')
    await expect(page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
  })

  test('filtra por cidade e por quem nao tem telefone, e ordena pela cidade', async ({ page }) => {
    // 213 cadastros sem numero discavel vieram do sistema antigo. Nome de
    // cliente sem telefone e ficha pela metade, e ate agora nao havia como
    // listar quais sao para ir completando.
    await page.goto('/clientes?telefone=sem')
    const tabela = page.getByRole('table', { name: 'Clientes' })
    await expect(tabela.getByRole('row').nth(1)).toContainText('sem telefone')
    const semTelefone = await page.getByRole('heading', { name: 'Cadastros' }).locator('..').innerText()

    await page.goto('/clientes')
    const todos = await page.getByRole('heading', { name: 'Cadastros' }).locator('..').innerText()
    expect(todos).not.toBe(semTelefone)

    // Ordenar pela cidade e escolha que mora no endereco: da para guardar o link.
    await page.getByRole('link', { name: 'Cidade' }).click()
    await expect(page).toHaveURL(/ordenar=cidade/)
    await expect(tabela.getByRole('columnheader', { name: 'Cidade' })).toHaveAttribute('aria-sort', 'ascending')
  })

  test('cadastrar com telefone repetido avisa, e confirmar cadastra', async ({ page }) => {
    const nome = `Cliente e2e ${Date.now()}`
    await page.goto('/clientes/novo')
    await campoDe(page, 'Nome').fill(nome)
    await campoDe(page, 'Telefone', { exact: true }).fill('(38) 99968-1168')
    await page.getByRole('button', { name: 'Salvar' }).click()

    const aviso = page.getByRole('alert').filter({ hasText: 'Já existe cadastro com este telefone' })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('ASSOCIAÇÃO DE ENSINO')
    // O next dev compila a action na primeira chamada; sob carga passa de 10 s.
    await expect(page).toHaveURL(/\/clientes\/novo/, { timeout: 30_000 })

    await campoDe(page, 'É outra pessoa. Cadastrar mesmo assim.').check()
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: nome })).toBeVisible()
    await expect(page.getByText('(38) 99968-1168')).toBeVisible()
  })

  test('ficha do cliente legado mostra o telefone completado e o original', async ({ page }) => {
    await page.goto('/clientes?q=factu')
    await page.getByRole('link', { name: /ASSOCIAÇÃO DE ENSINO/ }).click()
    await expect(page.getByRole('heading', { name: /ASSOCIAÇÃO DE ENSINO/ })).toBeVisible()
    await expect(page.getByText('(38) 99968-1168')).toBeVisible()
    await expect(page.getByText('no legado: (38)9968-1168')).toBeVisible()
    await expect(page.getByText('legado nº 26')).toBeVisible()
  })
})
