import { test, expect, type Page } from '@playwright/test'
import { campoDe, entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

async function ordemPara(page: Page, linha: string, prometida: string | null): Promise<string> {
  await page.goto('/ordens/nova')
  // "Ordem de serviço" virou ABA na tela de nova ordem, e quem cria e o botao
  // do formulario abaixo dela -- que diz o que vai acontecer.
  await page.getByRole('button', { name: 'Abrir ordem de serviço' }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const campo = campoDe(page, 'Lançar item ou acréscimo')
  await campo.fill(linha)
  await campo.press('Enter')
  await expect(campo).toHaveValue('', { timeout: 30_000 })
  if (prometida !== null) {
    await campoDe(page, 'Entrega prometida').fill(prometida)
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
  }
  return (await page.getByRole('heading', { name: /nº (\d{6})/ }).textContent())?.match(/(\d{6})/)?.[1] ?? ''
}

test.describe('Produção', () => {
  test('a fila mostra o que produzir por urgencia, sem valor, e o botao finaliza o servico', async ({ page }) => {
    await entrar(page)
    const atrasada = await ordemPara(page, '2 PLACA ACM ATRASADA 100,00', '2020-01-01')
    const semData = await ordemPara(page, '1 BANNER SEM DATA 80,00', null)

    await page.goto('/producao')
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Atrasadas/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Sem data combinada/ })).toBeVisible()

    // O que a producao precisa ler esta na tela; o que ela nao pode ver, nao esta.
    // `.bancada-servico` e a linha de um servico na fila: a tela deixou de ser
    // uma grade de cartoes e virou uma lista, onde o TRABALHO e a manchete.
    const servico = page.locator('.bancada-servico').filter({ hasText: atrasada })
    await expect(servico.getByText('PLACA ACM ATRASADA')).toBeVisible()
    await expect(page.getByText('R$ 100,00')).toHaveCount(0)
    await expect(page.getByText('R$')).toHaveCount(0)

    await servico.getByRole('button', { name: 'Serviço finalizado' }).click()
    await expect(page.locator('.bancada-servico').filter({ hasText: atrasada })).toHaveCount(0, { timeout: 30_000 })
    // O grupo "sem data combinada" nasce fechado -- sao ordens esperando alguem
    // combinar entrega, nao trabalho da vez -- entao o cartao existe e esta oculto.
    // Abrir o grupo para conferir que a ordem continua na fila.
    await page.locator('summary').filter({ hasText: 'Sem data combinada' }).click()
    await expect(page.locator('.bancada-servico').filter({ hasText: semData })).toBeVisible()

    // Finalizar na producao move o eixo de producao e nao encosta no de pagamento.
    await page.goto(`/ordens?q=${atrasada}`)
    const linha = page.getByRole('row').filter({ hasText: atrasada })
    await expect(linha).toContainText('Serviço finalizado')
    await expect(linha).toContainText('Não pago')
  })

  test('operacao entra e cai direto na fila de producao, sem menu de administracao', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Produção' })).toBeVisible()
    for (const escondido of ['Financeiro', 'Operação', 'Usuários', 'Dados da empresa', 'Materiais e preços']) {
      await expect(page.getByRole('link', { name: escondido })).toHaveCount(0)
    }
    await page.goto('/usuarios')
    await expect(page).toHaveURL(/\/$/)
  })
})
