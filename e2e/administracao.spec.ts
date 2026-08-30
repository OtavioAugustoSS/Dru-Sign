import { test, expect } from '@playwright/test'
import { campoDe, entrar } from './apoio'

test.describe('Administração', () => {
  test('operacao mostra os indicadores com o alvo da spec e o ano a ano', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Indicadores' }).click()
    await expect(page).toHaveURL(/\/operacao$/)
    await expect(page.getByTestId('nao-finalizadas')).toContainText('%')
    await expect(page.getByText('Alvo: abaixo de 5%. No legado, 29,4% em 2025.')).toBeVisible()
    await expect(page.getByTestId('valor-parado')).toContainText('R$')
    await expect(page.getByTestId('pessoas')).toBeVisible()
    // O ano a ano nasce das ordens do sistema novo. Com o banco recem-limpo a
    // tabela nao existe, e o que precisa estar certo ai e o estado vazio.
    const anoAAno = page.getByRole('table', { name: 'Ano a ano' })
    if (await anoAAno.count() === 0) {
      await expect(page.getByText('Os números aparecem quando a primeira ordem for aberta.')).toBeVisible()
    } else {
      await expect(anoAAno.getByRole('row').filter({ hasText: '2026' })).toBeVisible()
    }

    await campoDe(page, 'Aberta de').fill('2020-01-01')
    await campoDe(page, 'até').fill('2020-12-31')
    await page.getByRole('button', { name: 'Mostrar' }).click()
    await expect(page.getByText('Período de 2020-01-01 a 2020-12-31.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Nenhuma ordem ainda')).toBeVisible()
  })

  test('carteira agrupa os cadastros do mesmo CNPJ e separa a lista de reativacao', async ({ page }) => {
    await entrar(page)
    await page.goto('/clientes/carteira')
    await expect(page.getByRole('heading', { name: 'Carteira de clientes' })).toBeVisible()
    // A carteira le as duas eras. Sem o arquivo do sistema antigo importado ela
    // fica vazia, e o que precisa estar certo ai e o estado vazio.
    if (await page.getByTestId('faturado-total').count() === 0) {
      await expect(page.getByText('Nenhum cliente comprou ainda')).toBeVisible()
      return
    }
    await expect(page.getByTestId('faturado-total')).toContainText('R$')
    await expect(page.getByText('de 6 a 24 meses sem aparecer')).toBeVisible()

    // O que a tela existe para mostrar: a Prefeitura de Unai comprando por 18
    // cadastros do mesmo CNPJ, um por secretaria. Sem o agrupamento ela sumia
    // dentro de 18 linhas pequenas em vez de aparecer como o maior cliente.
    const concentracao = page.getByRole('table', { name: 'Concentração de receita' })
    await expect(concentracao).toBeVisible()
    await expect(concentracao.getByRole('row').nth(1)).toContainText('cadastros com o mesmo documento')
    await expect(page.getByText(/os \d+ maiores de/)).toBeVisible()

    // A lista de reativacao existe para alguem ligar: precisa do telefone nela.
    const reativar = page.getByRole('table', { name: 'Para reativar' })
    await expect(reativar.getByRole('columnheader', { name: 'Telefone' })).toBeVisible()
    await expect(reativar.getByRole('row').nth(1)).toContainText(/\(\d{2}\) \d/)
  })

  test('usuarios: cria, troca papel, desativa, e nao deixa se desativar', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Usuários' }).click()
    const login = `teste${Date.now()}`

    await campoDe(page, 'Nome').fill('Fulano de Teste')
    await campoDe(page, 'Login').fill(login)
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'escolha o papel' })).toBeVisible({ timeout: 30_000 })

    await campoDe(page, 'Papel').selectOption('operacao')
    await campoDe(page, 'Senha inicial').fill('curta')
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 8 caracteres' })).toBeVisible({ timeout: 30_000 })

    await campoDe(page, 'Senha inicial').fill('senha-boa-123')
    await page.getByRole('button', { name: 'Criar usuário' }).click()
    const linha = page.getByRole('row').filter({ hasText: login })
    await expect(linha).toBeVisible({ timeout: 30_000 })
    await expect(linha).toContainText('Operação')

    await linha.getByRole('button', { name: 'Editar' }).click()
    await campoDe(linha, /^Papel de/).selectOption('administracao')
    await linha.getByRole('button', { name: 'Gravar', exact: true }).click()
    await expect(linha).toContainText('Administração', { timeout: 30_000 })

    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(linha).toContainText('desativado', { timeout: 30_000 })

    // A propria linha nao tem botao de desativar: ninguem se tranca do lado de fora.
    const minhaLinha = page.getByRole('row').filter({ hasText: 'você' })
    await expect(minhaLinha.getByRole('button', { name: 'Desativar' })).toHaveCount(0)
  })

  /*
   * Este teste ESCREVE nos dados da empresa, que sao configuracao de verdade e
   * nao dado de teste. Rodando contra o banco de desenvolvimento, ele apagava o
   * endereco e o CNPJ reais da loja a cada rodada -- silenciosamente, porque
   * nada avisa que a configuracao voltou para um valor ficticio. Agora guarda o
   * que achou e devolve no fim.
   *
   * O conserto de verdade e o e2e rodar contra o banco de teste; enquanto isso
   * nao acontece, ao menos ele nao leva a configuracao junto.
   */
  test('dados da empresa saem no cabecalho do impresso', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Dados da empresa' }).click()

    const CAMPOS = ['Nome fantasia', 'CNPJ', 'Endereço', 'Cidade', 'UF'] as const
    const antes: Record<string, string> = {}
    for (const c of CAMPOS) antes[c] = await campoDe(page, c).inputValue()
    antes['Telefone'] = await campoDe(page, 'Telefone', { exact: true }).inputValue()

    await campoDe(page, 'Nome fantasia').fill('DruSign')
    await campoDe(page, 'CNPJ').fill('11.222.333/0001-81')
    await campoDe(page, 'Telefone', { exact: true }).fill('(38) 3676-1234')
    await campoDe(page, 'Endereço').fill('Rua Rio Preto, 100')
    await campoDe(page, 'Cidade').fill('Unaí')
    await campoDe(page, 'UF').fill('MG')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Salvo.' })).toBeVisible({ timeout: 30_000 })

    await campoDe(page, 'CNPJ').fill('123')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'CNPJ inválido' })).toBeVisible({ timeout: 30_000 })

    await page.goto('/ordens/nova')
    await page.getByRole('button', { name: 'Ordem de serviço', exact: true }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
    const id = page.url().split('/').pop()
    await page.goto(`/ordens/${id}/impresso`)
    await expect(page.getByText('DruSign').first()).toBeVisible()
    await expect(page.getByText('11.222.333/0001-81')).toBeVisible()
    await expect(page.getByText('Rua Rio Preto, 100')).toBeVisible()
    await expect(page.getByText('Unaí/MG')).toBeVisible()
    await expect(page.getByText('(38) 3676-1234')).toBeVisible()

    // Devolve a configuracao da loja como estava antes do teste.
    await page.goto('/empresa')
    for (const c of CAMPOS) await campoDe(page, c).fill(antes[c] ?? '')
    await campoDe(page, 'Telefone', { exact: true }).fill(antes['Telefone'] ?? '')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Salvo.' })).toBeVisible({ timeout: 30_000 })
  })
})
