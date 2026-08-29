import { test, expect, type Page } from '@playwright/test'
import { entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

async function ordemCom(page: Page, linha: string): Promise<string> {
  await page.goto('/ordens/nova')
  await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const campo = page.getByLabel('Lançar item ou acréscimo')
  await campo.fill(linha)
  await campo.press('Enter')
  await expect(campo).toHaveValue('', { timeout: 30_000 })
  const numero = (await page.getByRole('heading', { name: /nº (\d{6})/ }).textContent())?.match(/(\d{6})/)?.[1]
  return numero!
}

test.describe('Dinheiro', () => {
  test('balcao: concluir e receber grava os tres registros e o livro mostra a entrada', async ({ page }) => {
    await entrar(page)
    const numero = await ordemCom(page, '1 placa 150,00')
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Não pago')
    await expect(page.getByTestId('saldo')).toHaveText('R$ 150,00')
    await expect(page.getByLabel('Valor recebido')).toHaveValue('150,00')

    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'escolha a forma de pagamento' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })
    await expect(page.getByText(/Serviço finalizado · Pago/)).toBeVisible()
    await expect(page.getByRole('table', { name: 'Recebimentos' })).toContainText('Pix')
    await expect(page.getByRole('table', { name: 'Recebimentos' })).toContainText('R$ 150,00')
    await expect(page.getByRole('button', { name: 'Concluir e receber' })).toHaveCount(0)
    await expect(page.getByLabel('Lançar item ou acréscimo')).toHaveCount(0)

    await page.goto('/financeiro')
    const linha = page.getByRole('row').filter({ hasText: `OS ${numero}` })
    await expect(linha).toContainText('Entrada')
    await expect(linha).toContainText('VENDAS DIVERSAS')
    await expect(linha).toContainText('R$ 150,00')
  })

  test('parcial: servico finalizado sem dinheiro, recebe 80 de 200, aparece na fila com o que falta, recebe o resto', async ({ page }) => {
    await entrar(page)
    const numero = await ordemCom(page, '1 placa 200,00')
    await page.getByRole('button', { name: 'Serviço finalizado' }).click()
    await expect(page.getByText(/Serviço finalizado · Não pago/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Serviço finalizado' })).toHaveCount(0)

    await page.getByLabel('Valor recebido').fill('80')
    await page.getByLabel('Forma de pagamento').selectOption('dinheiro')
    await page.getByRole('button', { name: 'Receber', exact: true }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Parcial', { timeout: 30_000 })
    await expect(page.getByTestId('saldo')).toHaveText('R$ 120,00')
    await expect(page.getByLabel('Valor recebido')).toHaveValue('120,00')

    await page.goto('/')
    const aCobrar = page.getByRole('table', { name: 'Ordens a cobrar' })
    await expect(aCobrar.getByRole('row').filter({ hasText: numero })).toContainText('R$ 120,00')
    await aCobrar.getByRole('link', { name: numero }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/)

    await page.getByLabel('Valor recebido').fill('120,01')
    await page.getByLabel('Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Receber', exact: true }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })
    await page.goto('/')
    await expect(page.getByRole('table', { name: 'Ordens a cobrar' }).getByRole('row').filter({ hasText: numero })).toHaveCount(0)
  })

  test('acima do saldo e recusado; estorno volta a nao pago e fica riscado no livro', async ({ page }) => {
    await entrar(page)
    await ordemCom(page, '1 placa 100,00')
    await page.getByLabel('Valor recebido').fill('100,02')
    await page.getByLabel('Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'maior que o saldo a receber (R$ 100,00)' })).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('Valor recebido').fill('100')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })

    await page.getByRole('button', { name: 'Estornar' }).click()
    await page.getByLabel('Motivo do estorno').fill('valor digitado errado')
    await page.getByRole('button', { name: 'Confirmar estorno' }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Não pago', { timeout: 30_000 })
    await expect(page.getByRole('table', { name: 'Recebimentos' })).toContainText('estornado · valor digitado errado')
    await expect(page.getByRole('button', { name: 'Receber', exact: true })).toBeVisible()
  })

  test('lista de ordens filtra por situacao e mostra os dois eixos', async ({ page }) => {
    await entrar(page)
    const numero = await ordemCom(page, '1 placa 10,00')
    await page.goto(`/ordens?q=${numero}`)
    const linha = page.getByRole('row').filter({ hasText: numero })
    await expect(linha).toContainText('Aberta')
    await expect(linha).toContainText('Não pago')
    await page.goto(`/ordens?q=${numero}&estado=concluida`)
    await expect(page.getByText('Nenhuma ordem com esse filtro')).toBeVisible()
  })

  test('financeiro: nova saida parcelada no livro do mes, totais e estorno', async ({ page }) => {
    await entrar(page)
    // Historico unico: o livro guarda tudo o que as rodadas anteriores lancaram, e uma
    // linha de outra rodada ja estornada nao tem mais botao de estornar.
    const historico = `Conta de água ${Date.now()}`
    await page.goto('/financeiro/saida')
    await page.getByLabel('Valor').fill('45,90')
    await page.getByLabel('Conta').selectOption({ label: '3 · AGUA' })
    await page.getByLabel('Histórico').fill(historico)
    await page.getByLabel('Fornecedor').fill('COPASA')
    await page.getByLabel('Parcela', { exact: true }).fill('2')
    await page.getByLabel('Total de parcelas').fill('3')
    await page.getByRole('button', { name: 'Lançar saída' }).click()
    await expect(page).toHaveURL(/\/financeiro$/, { timeout: 30_000 })
    const linha = page.getByRole('row').filter({ hasText: historico })
    await expect(linha).toContainText('COPASA')
    await expect(linha).toContainText('parcela 2/3')
    await expect(linha).toContainText('−R$ 45,90')

    await linha.getByRole('button', { name: 'Estornar' }).click()
    await linha.getByLabel('Motivo do estorno').fill('lançado em duplicidade')
    await linha.getByRole('button', { name: 'Confirmar' }).click()
    await expect(linha).toContainText('estornado · lançado em duplicidade', { timeout: 30_000 })
  })

  // Contexto proprio: /entrar redireciona quem ja tem sessao, entao trocar de usuario
  // no meio do teste nao funciona. Mesmo formato do teste de Materiais.
  test('operacao nao ve nem abre o Financeiro', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Plano de contas' })).toHaveCount(0)
    await page.goto('/financeiro')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de trabalho' })).toBeVisible()
  })

  test('plano de contas: as 48 do legado por grupo, VENDAS DIVERSAS recebe as vendas, conta nova e desativar', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Plano de contas' }).click()
    await expect(page).toHaveURL(/\/plano-de-contas$/)
    await expect(page.getByRole('row').filter({ hasText: 'VENDAS DIVERSAS' })).toContainText('recebe as vendas')
    await expect(page.getByRole('heading', { name: 'DESPESAS COM VEICULO' })).toBeVisible()
    await expect(page.getByText('MANUTENÇÃO DO VEÍCULO')).toBeVisible()

    const nome = `MARKETING DIGITAL ${Date.now()}`
    await page.getByLabel('Nova conta').fill(nome)
    await page.getByLabel('Tipo').selectOption('despesa')
    await page.getByLabel('Grupo').fill('DESPESAS')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    const linha = page.getByRole('row').filter({ hasText: nome })
    await expect(linha).toBeVisible({ timeout: 30_000 })
    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(linha).toHaveCount(0, { timeout: 30_000 })
    await page.goto('/plano-de-contas?inativas=1')
    await expect(page.getByRole('row').filter({ hasText: nome })).toContainText('desativada')
  })
})
