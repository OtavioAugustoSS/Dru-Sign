import { test, expect, type Page } from '@playwright/test'
import { campoDe, entrar } from './apoio'

/**
 * Abre a dobra do ajuste de preco.
 *
 * Ajustar preco virou excecao, nao caminho normal: o formulario esta dentro de um
 * `<details>` que so nasce aberto quando ja existe ajuste. Por isso o guarda --
 * clicar num que ja esta aberto fecharia.
 */
async function abrirAjuste(page: Page): Promise<void> {
  if (await campoDe(page, 'Preço final').isVisible()) return
  await page.getByText('Ajustar o preço').click()
  await expect(campoDe(page, 'Preço final')).toBeVisible()
}

/** As seis linhas da OS 18449 exatamente como a Odete digitava no legado. */
const LINHAS_18449 = [
  '06 PLACAS ACM 60X 80 E ADES/ IMP  120,50 CD  723,00',
  '01 PLACA ACM 50 X 50 E ADES/ IMP  62,00',
  '03PLACAS ACM 51X 61 E ADES/ IMP 76,00 CD 228,00',
  '12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00  CD 732,00',
  '06PLACAS ACM 61 X 61  E ADES/ IMP 93,00 CD 558,00',
  '03 PLACAS  50 X 60 E ADES/ IMP      75,00 CD 225,00',
]

/**
 * A tela de nova ordem agora e ABA + formulario: a aba escolhe o que se esta
 * abrindo e o botao abaixo dela e o ato de abrir. Por isso sao dois passos aqui
 * -- e o `?tipo=` no endereco e o mesmo que a aba escreveria, entao serve tanto
 * para o teste quanto para um link que alguem guarde.
 */
async function novaOrdem(page: Page, estado: 'Ordem de serviço' | 'Orçamento' = 'Ordem de serviço'): Promise<string> {
  const orcamento = estado === 'Orçamento'
  await page.goto(orcamento ? '/ordens/nova?tipo=orcamento' : '/ordens/nova')
  await page.getByRole('button', { name: orcamento ? 'Abrir orçamento' : 'Abrir ordem de serviço' }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  return page.url()
}

async function lancar(page: Page, linha: string) {
  const campo = campoDe(page, 'Lançar item ou acréscimo')
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

    const campo = campoDe(page, 'Lançar item ou acréscimo')
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

    await abrirAjuste(page)
    await campoDe(page, 'Preço final').fill('2050,00')
    await campoDe(page, 'Motivo do ajuste').fill('arredondamento comercial')
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

    await abrirAjuste(page)
    // Campo do ajuste acompanha o total: depois do acrescimo mostra 2102,00, nao o 2000,00 de antes.
    await expect(campoDe(page, 'Preço final')).toHaveValue('2102,00')

    await campoDe(page, 'Preço final').fill('2050.50')
    await campoDe(page, 'Motivo do ajuste').fill('cliente antigo')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,50', { timeout: 30_000 })

    await campoDe(page, 'Preço final').fill('dois mil')
    await page.getByRole('button', { name: 'Ajustar preço' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Preço inválido' })).toBeVisible()
    await expect(page.getByTestId('preco-final')).toHaveText('R$ 2.050,50')
  })

  test('pendencia nao grava; Esc limpa; segundo Enter nao conflita', async ({ page }) => {
    await novaOrdem(page)
    const campo = campoDe(page, 'Lançar item ou acréscimo')
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

    // O endereco da ordem guardado antes: cancelar leva para a lista, e `goBack`
    // nao garante a volta para a ficha -- depende de como a acao mexeu no historico.
    const daOrdem = page.url()
    await page.getByRole('button', { name: 'Cancelar ordem' }).click()
    await campoDe(page, 'Motivo do cancelamento').fill('cliente desistiu')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page).toHaveURL(/\/ordens$/, { timeout: 30_000 })
    await page.goto(daOrdem)
    await expect(page.getByText('Cancelada', { exact: true })).toBeVisible()
    await expect(page.getByText('cliente desistiu')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Itens da ordem' }).locator('tbody tr')).toHaveCount(1)
    await expect(campoDe(page, 'Lançar item ou acréscimo')).toHaveCount(0)
  })

  test('cabecalho: escolher o cliente ja grava, e a ordem sobrevive ao recarregar', async ({ page }) => {
    await novaOrdem(page)
    await campoDe(page, 'Cliente').fill('factu')
    await page.getByRole('option').filter({ hasText: 'ASSOCIAÇÃO DE ENSINO' }).getByRole('button').click()

    // Sem clicar em "Salvar cabeçalho": escolher o cliente grava sozinho. Era
    // aqui que a ordem seguia para a bancada como "Venda de balcao" -- o nome
    // aparecia no campo e ninguem sabia que faltava gravar.
    await expect(page.getByText(/ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ · FACTU/)).toBeVisible({ timeout: 30_000 })
    await page.reload()
    await expect(page.getByText(/ASSOCIAÇÃO DE ENSINO E PERQUISA DE UNAÍ · FACTU/)).toBeVisible()

    // A data continua no fluxo do botao: ela nao e escolha de lista.
    //
    // Sem espera nenhuma, de proposito: preencher LOGO depois do `reload` cai na
    // janela em que o React ainda nao assumiu o formulario, e e exatamente essa
    // janela que precisa continuar funcionando. Enquanto os campos eram estado do
    // React, o valor digitado ali era descartado na hidratacao e a tela dizia
    // "Salvo." sem a data. Este teste e o que trava a correcao.
    await campoDe(page, 'Entrega prometida').fill('2026-09-04')
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('entrega prometida 4 de setembro')).toBeVisible()
  })

  test('cabecalho: cadastrar o cliente dentro da ordem ja deixa a ordem no nome dele', async ({ page }) => {
    await novaOrdem(page)
    const nome = `Serralheria e2e ${Date.now()}`
    await campoDe(page, 'Cliente').fill(nome)
    await page.getByRole('button', { name: `Cadastrar “${nome}”` }).click()
    await campoDe(page, 'Telefone').fill('(38) 99111-2222')
    await page.getByRole('button', { name: 'Cadastrar e usar' }).click()

    await expect(page.getByText(new RegExp(`${nome} · \\(38\\) 99111-2222`))).toBeVisible({ timeout: 30_000 })
    await page.reload()
    await expect(page.getByText(new RegExp(nome))).toBeVisible()
  })

  /**
   * A trava otimista sempre funcionou; o que faltava era ela APARECER.
   *
   * O balcao e a bancada abrem a mesma ordem ao mesmo tempo o dia inteiro. Quem
   * gravava por ultimo tinha a gravacao recusada e nao era avisado de nada: o
   * campo nao e controlado, entao continuava mostrando o texto digitado, e a
   * pessoa saia de perto achando que o recado estava na ordem. Este teste falha
   * se alguem voltar a esconder o conflito.
   */
  test('duas telas na mesma ordem: quem perde a corrida e avisado, e nao fica olhando texto que nao gravou', async ({ page }) => {
    const url = await novaOrdem(page)
    const segunda = await page.context().newPage()
    await segunda.goto(url)
    await expect(campoDe(segunda, 'Observações')).toBeVisible({ timeout: 30_000 })

    // A primeira grava. A versao da ordem no banco avanca, e a segunda tela
    // continua com a versao que carregou.
    await campoDe(page, 'Observações').fill('entregar na fazenda')
    await page.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })

    await campoDe(segunda, 'Observações').fill('cliente vem buscar')
    await segunda.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(segunda.getByText('A ordem mudou. Confira os valores e tente de novo.')).toBeVisible({ timeout: 30_000 })

    // O aviso nao e beco sem saida: a recusa ja recarregou a ordem, entao a
    // segunda tentativa grava.
    await segunda.getByRole('button', { name: 'Salvar cabeçalho' }).click()
    await expect(segunda.getByText('Salvo.')).toBeVisible({ timeout: 30_000 })
    await segunda.close()
  })
})
