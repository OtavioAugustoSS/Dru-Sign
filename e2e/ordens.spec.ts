import { test, expect, type Page } from '@playwright/test'
import { entrar } from './apoio'

/** As seis linhas da OS 18449 exatamente como a Odete digitava no legado. */
const LINHAS_18449 = [
  '06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00',
  '01 PLACA ACM 50 X 50 E ADES/ IMP  62,00',
  '03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00',
  '12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00',
  '06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00',
  '03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00',
]

async function novaOrdem(page: Page, estado: 'Ordem de serviço' | 'Orçamento' = 'Ordem de serviço'): Promise<string> {
  await page.goto('/ordens/nova')
  await page.getByRole('button', { name: estado, exact: true }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  return page.url()
}

async function lancar(page: Page, linha: string) {
  const campo = page.getByLabel('Lançar item ou acréscimo')
  await campo.fill(linha)
  await campo.press('Enter')
  await expect(campo).toHaveValue('', { timeout: 30_000 })
}

test.describe('Ordem de serviço', () => {
  test.beforeEach(async ({ page }) => { await entrar(page) })

  test('reproduz a OS 18449 digitando as seis linhas do legado: R$ 2.528,00', async ({ page }) => {
    await novaOrdem(page)
    // O contador anda a cada rodada (ja passou de 18500): o que importa aqui e o total, nao o numero.
    await expect(page.getByRole('heading', { name: /Ordem de serviço nº \d{6}/ })).toBeVisible({ timeout: 60_000 })

    const campo = page.getByLabel('Lançar item ou acréscimo')
    await campo.fill(LINHAS_18449[3]!)
    await expect(page.getByText('Entendi: qtd 12 · PLACAS ACM E ADES/ IMP · 0,61 × 0,40 m · R$ 61,00/un')).toBeVisible()
    await expect(page.getByText('→ R$ 732,00')).toBeVisible()
    await campo.fill('')

    for (const linha of LINHAS_18449) await lancar(page, linha)

    const tabela = page.getByRole('table', { name: 'Itens da ordem' })
    await expect(tabela.locator('tbody tr')).toHaveCount(6)
    await expect(tabela.locator('tbody tr').nth(3)).toContainText('por unidade')
    await expect(tabela.locator('tbody tr').nth(3)).toContainText('0,61 × 0,40 m')
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.528,00')
  })

  test('acrescimo com +, ajuste de preco com motivo, aviso de divergencia e remocao de item', async ({ page }) => {
    await novaOrdem(page)
    await lancar(page, '2 placa 1000,00')
    await lancar(page, '+deslocamento 34 km 102,00')
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.102,00')
    await expect(page.getByText('Deslocamento · 34 km')).toBeVisible()

    await page.getByLabel('Preço final').fill('2050,00')
    await page.getByLabel('Motivo do ajuste').fill('arredondamento comercial')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,00', { timeout: 30_000 })
    await expect(page.getByText('Desconto de R$ 52,00 · arredondamento comercial')).toBeVisible()

    await lancar(page, '1 placa 100,00')
    await expect(page.getByRole('alert').filter({ hasText: 'O calculado passou de R$ 2.102,00 para R$ 2.202,00' })).toBeVisible()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,00')
    await page.getByRole('button', { name: 'Usar o calculado' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.202,00', { timeout: 30_000 })

    const linhas = page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')
    await linhas.nth(1).getByRole('button', { name: 'Remover' }).click()
    await expect(linhas).toHaveCount(1, { timeout: 30_000 })
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.102,00')
  })

  test('ajuste digitado com ponto decimal vale dois mil, nao duzentos mil', async ({ page }) => {
    await novaOrdem(page)
    await lancar(page, '2 placa 1000,00')
    await lancar(page, '+deslocamento 34 km 102,00')

    // Campo do ajuste acompanha o total: depois do acrescimo mostra 2102,00, nao o 2000,00 de antes.
    await expect(page.getByLabel('Preço final')).toHaveValue('2102,00')

    await page.getByLabel('Preço final').fill('2050.50')
    await page.getByLabel('Motivo do ajuste').fill('cliente antigo')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,50', { timeout: 30_000 })

    await page.getByLabel('Preço final').fill('dois mil')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Preço inválido' })).toBeVisible()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,50')
  })

  test('pendencia nao grava; Esc limpa; segundo Enter nao conflita', async ({ page }) => {
    await novaOrdem(page)
    const campo = page.getByLabel('Lançar item ou acréscimo')
    await campo.fill('3 banner 200x100')
    await campo.press('Enter')
    await expect(page.getByRole('alert').filter({ hasText: 'Falta o valor unitário' })).toBeVisible()
    await expect(campo).toHaveValue('3 banner 200x100')
    await campo.press('Escape')
    await expect(campo).toHaveValue('')

    await lancar(page, '1 placa 62,00')
    await lancar(page, '3 placas 75,00')
    await expect(page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')).toHaveCount(2)
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 287,00')
  })

  test('orcamento: aprovar vira ordem aberta; cancelar com motivo preserva os itens', async ({ page }) => {
    await novaOrdem(page, 'Orçamento')
    await expect(page.getByRole('heading', { name: /Orçamento nº/ })).toBeVisible({ timeout: 60_000 })
    await lancar(page, '1 placa 90,00')
    await page.getByRole('button', { name: 'Aprovar orçamento' }).click()
    await expect(page.getByRole('heading', { name: /Ordem de serviço nº/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Orçamento aprovado em/)).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar ordem' }).click()
    await page.getByLabel('Motivo do cancelamento').fill('cliente desistiu')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page).toHaveURL(/\/ordens$/, { timeout: 30_000 })
    await page.goBack()
    await expect(page.getByText('Cancelada · cliente desistiu')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')).toHaveCount(1)
    await expect(page.getByLabel('Lançar item ou acréscimo')).toHaveCount(0)
  })

  test('cabecalho: escolhe o cliente pela busca e a ordem passa a mostrar o apelido', async ({ page }) => {
    await novaOrdem(page)
    await page.getByLabel('Cliente').fill('factu')
    await page.getByRole('option').filter({ hasText: 'ASSOCIAÇÃO DE ENSINO' }).getByRole('button').click()
    await page.getByLabel('Entrega prometida').fill('2026-09-04')
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ · FACTU/)).toBeVisible()
    await expect(page.getByText('entrega prometida 4 de setembro')).toBeVisible()
  })
})
