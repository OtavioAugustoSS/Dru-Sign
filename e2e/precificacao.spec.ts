import { test, expect, type Page } from '@playwright/test'
import { campoDe, entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

/** Nome unico por teste: a suite roda contra um banco que ja tem catalogo. */
const unico = (p: string) => `${p} e2e ${Date.now()}-${Math.floor(Math.random() * 1000)}`

/** Cria uma familia pela tela e devolve o nome dela. */
async function criarFamilia(page: Page, margem: string) {
  const nome = unico('Bobina')
  await page.goto('/precificacao')
  await campoDe(page, 'Família', { exact: true }).fill(nome)
  await campoDe(page, 'Cobrado').selectOption('m2')
  await campoDe(page, 'Margem', { exact: true }).fill(margem)
  await page.getByRole('button', { name: 'Criar família' }).click()
  await expect(page.getByRole('link', { name: nome })).toBeVisible({ timeout: 30_000 })
  return nome
}

/**
 * Salva o formulario e acha a linha pelo filtro da propria tela.
 *
 * Duas razoes para nao ir direto de `goto`: o catalogo real tem dezenas de materiais numa
 * tabela paginada, entao a linha nova quase nunca esta na pagina 1; e um `goto` disparado
 * no mesmo instante do POST estoura o teto de conexoes do PGlite e a pagina volta 500.
 * Filtrar pelo formulario e o caminho que uma pessoa faria, e espera o redirect terminar.
 */
async function salvarEAchar(page: Page, nome: string) {
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.waitForURL(/\/materiais$/, { timeout: 30_000 })
  await campoDe(page, 'Buscar').fill(nome)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await page.waitForURL(/[?&]q=/, { timeout: 30_000 })
  return page.getByRole('row', { name: new RegExp(nome) })
}

test.describe('Precificação por família', () => {
  test('a familia calcula a venda a partir do custo, e o preco deixa de ser digitado', async ({ page }) => {
    await entrar(page)
    const familia = await criarFamilia(page, '120')

    const material = unico('Lona 440g')
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(material)
    await campoDe(page, 'Cobrado').selectOption('m2')
    await campoDe(page, 'Família de preço').selectOption({ label: `${familia} (margem 120%)` })
    await campoDe(page, 'Custo').fill('38,00')

    // 38 x 2,20 = 83,60, calculado na tela antes de salvar.
    await expect(page.locator('#preco')).toHaveValue('R$ 83,60')

    const linha = await salvarEAchar(page, material)
    await expect(linha).toContainText('R$ 83,60', { timeout: 30_000 })
    await expect(linha).toContainText('R$ 38,00')
    await expect(linha).toContainText(familia)
  })

  test('preco travado ignora a familia', async ({ page }) => {
    await entrar(page)
    const familia = await criarFamilia(page, '120')

    const material = unico('ACM travado')
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(material)
    await campoDe(page, 'Cobrado').selectOption('m2')
    await campoDe(page, 'Família de preço').selectOption({ label: `${familia} (margem 120%)` })
    await campoDe(page, 'Custo').fill('38,00')
    await campoDe(page, 'Travar preço').check()
    // Travado, o campo volta a aceitar o valor digitado em vez do calculado.
    await campoDe(page, 'Preço de venda').fill('265,00')

    const linha = await salvarEAchar(page, material)
    await expect(linha).toContainText('R$ 265,00', { timeout: 30_000 })
    await expect(linha).toContainText('travado')
  })

  test('o simulador mostra o impacto antes de aplicar, e o historico registra', async ({ page }) => {
    await entrar(page)
    const familia = await criarFamilia(page, '100')

    const material = unico('Lona simulada')
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(material)
    await campoDe(page, 'Cobrado').selectOption('m2')
    await campoDe(page, 'Família de preço').selectOption({ label: `${familia} (margem 100%)` })
    await campoDe(page, 'Custo').fill('50,00')
    await expect(await salvarEAchar(page, material)).toContainText('R$ 100,00', { timeout: 30_000 })

    await page.goto('/precificacao')
    await page.locator('.card', { hasText: familia }).getByRole('link', { name: 'Ajustar preços' }).click()
    await expect(page).toHaveURL(/\/precificacao\/[0-9a-f-]+/)

    // Simular nao grava: a coluna "Ficaria" muda e o botao passa a dizer quantos.
    await campoDe(page, 'Margem sobre o custo').fill('150')
    await expect(page.getByRole('row', { name: new RegExp(material) })).toContainText('R$ 125,00')
    await page.getByRole('button', { name: 'Aplicar a 1' }).click()
    await expect(page.getByRole('status')).toContainText('1 preços atualizados', { timeout: 30_000 })

    // O historico do material guarda de quanto para quanto, e por que.
    await page.goto(`/materiais?q=${encodeURIComponent(material)}`)
    await page.getByRole('row', { name: new RegExp(material) }).getByRole('link', { name: material }).click()
    const historico = page.locator('.card', { hasText: 'Histórico de preço' })
    await expect(historico).toContainText('margem da família', { timeout: 30_000 })
    await expect(historico).toContainText('R$ 125,00')
  })

  test('clicar na celula de venda abre a edicao com o campo em foco', async ({ page }) => {
    await entrar(page)
    const material = unico('Material do foco')
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(material)
    await campoDe(page, 'Cobrado').selectOption('unidade')
    await campoDe(page, 'Preço de venda').fill('45,00')

    const linha = await salvarEAchar(page, material)
    await expect(linha).toContainText('R$ 45,00', { timeout: 30_000 })
    await linha.getByRole('link', { name: 'R$ 45,00' }).click()

    await expect(page).toHaveURL(/\/materiais\/[0-9a-f-]+\?foco=preco/)
    await expect(campoDe(page, 'Preço de venda')).toBeFocused()
  })

  test('familia com material vinculado nao pode ser excluida', async ({ page }) => {
    await entrar(page)
    const familia = await criarFamilia(page, '120')

    // Sem material ainda: o botao de excluir existe.
    await expect(page.locator('.card', { hasText: familia }).getByRole('button', { name: 'Excluir' })).toBeVisible()

    const material = unico('Vinculado')
    await page.goto('/materiais')
    await campoDe(page, 'Material').fill(material)
    await campoDe(page, 'Cobrado').selectOption('m2')
    await campoDe(page, 'Família de preço').selectOption({ label: `${familia} (margem 120%)` })
    await campoDe(page, 'Preço de venda').fill('10,00')
    await expect(await salvarEAchar(page, material)).toBeVisible({ timeout: 30_000 })

    // Com material vinculado o botao some -- um botao que sempre recusa engana.
    await page.goto('/precificacao')
    await expect(page.locator('.card', { hasText: familia }).getByRole('button', { name: 'Excluir' })).toHaveCount(0)
  })

  test('operacao nao ve nem abre Precificação', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Precificação' })).toHaveCount(0)
    await page.goto('/precificacao')
    await expect(page).toHaveURL(/\/$/)
  })
})
