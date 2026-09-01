import { test, expect, type Page } from '@playwright/test'
import { campoDe, entrar, entrarComo, LOGIN_OPERACAO, SENHA_OPERACAO } from './apoio'

async function ordemCom(page: Page, linha: string): Promise<string> {
  await page.goto('/ordens/nova')
  // "Ordem de serviço" virou ABA na tela de nova ordem, e quem cria e o botao
  // do formulario abaixo dela -- que diz o que vai acontecer.
  await page.getByRole('button', { name: 'Abrir ordem de serviço' }).click()
  await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const campo = campoDe(page, 'Lançar item ou acréscimo')
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
    await expect(campoDe(page, 'Valor recebido')).toHaveValue('150,00')

    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'escolha a forma de pagamento' })).toBeVisible({ timeout: 30_000 })

    await campoDe(page, 'Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })
    await expect(page.getByText('Serviço finalizado', { exact: true })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Recebimentos' })).toContainText('Pix')
    await expect(page.getByRole('table', { name: 'Recebimentos' })).toContainText('R$ 150,00')
    await expect(page.getByRole('button', { name: 'Concluir e receber' })).toHaveCount(0)
    await expect(campoDe(page, 'Lançar item ou acréscimo')).toHaveCount(0)

    await page.goto('/financeiro')
    const linha = page.getByRole('row').filter({ hasText: `OS ${numero}` })
    await expect(linha).toContainText('Entrada')
    await expect(linha).toContainText('Vendas de serviços')
    await expect(linha).toContainText('R$ 150,00')

    // A entrada nao se estorna no livro: ela nasce do recebimento e some junto
    // com ele, na ordem. A linha precisa dizer isso, senao a celula fica vazia
    // e quem quer desfazer nao tem para onde ir.
    await linha.getByRole('link', { name: 'Desfazer na ordem' }).click()
    // `?de=financeiro`: quem veio do livro-caixa conferindo dinheiro volta para
    // o livro-caixa, e nao para a lista de ordens.
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}\?de=financeiro$/)
    await expect(page.getByRole('table', { name: 'Recebimentos' }).getByRole('button', { name: 'Estornar' })).toBeVisible()
  })

  test('parcial: servico finalizado sem dinheiro, recebe 80 de 200, aparece na fila com o que falta, recebe o resto', async ({ page }) => {
    await entrar(page)
    const numero = await ordemCom(page, '1 placa 200,00')
    await page.getByRole('button', { name: 'Serviço finalizado' }).click()
    await expect(page.getByText('Serviço finalizado', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Não pago')
    await expect(page.getByRole('button', { name: 'Serviço finalizado' })).toHaveCount(0)

    await campoDe(page, 'Valor recebido').fill('80')
    await campoDe(page, 'Forma de pagamento').selectOption('dinheiro')
    await page.getByRole('button', { name: 'Receber', exact: true }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Parcial', { timeout: 30_000 })
    await expect(page.getByTestId('saldo')).toHaveText('R$ 120,00')
    await expect(campoDe(page, 'Valor recebido')).toHaveValue('120,00')

    await page.goto('/')
    const aCobrar = page.getByRole('table', { name: 'Ordens a cobrar' })
    await expect(aCobrar.getByRole('row').filter({ hasText: numero })).toContainText('R$ 120,00')
    await aCobrar.getByRole('link', { name: numero }).click()
    await expect(page).toHaveURL(/\/ordens\/[0-9a-f-]{36}\?de=fila$/)

    await campoDe(page, 'Valor recebido').fill('120,01')
    await campoDe(page, 'Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Receber', exact: true }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })
    await page.goto('/')
    await expect(page.getByRole('table', { name: 'Ordens a cobrar' }).getByRole('row').filter({ hasText: numero })).toHaveCount(0)
  })

  /*
   * A JANELA ENTRE O HTML CHEGAR E O REACT ASSUMIR -- e por que ela e sobre dinheiro.
   *
   * O campo do valor nasce preenchido com o SALDO INTEIRO. Enquanto ele era estado
   * do React, quem apagasse e digitasse um valor parcial nessa janela escrevia so
   * no DOM: a hidratacao devolvia o saldo cheio, e o clique seguinte registrava o
   * valor CHEIO no caixa e marcava a ordem como paga. Cliente devendo, sistema
   * dizendo que nao deve.
   *
   * O teste espera DEPOIS de digitar, de proposito: e a espera que da tempo de a
   * hidratacao acontecer. Se ela reescrever o campo, a assercao cai -- e cai
   * sempre, nao as vezes.
   */
  test('o valor digitado antes de a tela hidratar e o valor que vai para o caixa', async ({ page }) => {
    await entrar(page)
    await ordemCom(page, '1 placa 200,00')
    await expect(campoDe(page, 'Valor recebido')).toHaveValue('200,00')

    // Recarregar e digitar SEM esperar: e a janela entre o HTML do servidor
    // aparecer e o React assumir o formulario. O campo nasce com o saldo inteiro,
    // e quem apaga e digita um valor parcial ali escrevia so no DOM -- a
    // hidratacao devolvia os 200,00 e o clique seguinte mandava 200,00 para o
    // caixa, marcando como paga uma ordem que o cliente pagou pela metade.
    await page.reload()
    // Uma assercao que resolve contra o HTML DO SERVIDOR, antes da hidratacao:
    // e ela que faz o `fill` comecar o mais cedo possivel, dentro da janela.
    await expect(page.getByTestId('saldo')).toHaveText('R$ 200,00')
    await campoDe(page, 'Valor recebido').fill('50')
    // A espera vem DEPOIS de digitar, de proposito: e ela que da tempo de a
    // hidratacao acontecer. Se o React reescrever o campo, esta assercao cai.
    //
    // HONESTIDADE SOBRE O QUE ESTE TESTE GARANTE: ele e PROBABILISTICO nas DUAS
    // direcoes. Medido contra o codigo com o defeito de volta, falhou em 1 de 3
    // rodadas -- nas outras duas o `fill` chegou depois da hidratacao e nao
    // alcancou a janela. Com a correcao, 5 de 5 passam isolado.
    //
    // Mas ele TAMBEM fica vermelho sozinho, sem defeito nenhum. Medido em
    // 01/09 por experimento controlado: com as mudancas do dia guardadas no
    // stash, rodando o commit anterior intocado, `--repeat-each=5` deu 1 falha
    // em 5 -- mesmo sintoma, campo voltando a "200,00". Sob carga a pagina
    // re-renderiza por outro motivo e desfaz o `fill`.
    //
    // Entao: verde nao prova que o defeito nao voltou, e vermelho tambem nao
    // prova que voltou. Vermelho aqui e MOTIVO PARA INVESTIGAR, e a
    // investigacao que vale e a que separa as duas causas: guarde a sua
    // mudanca (`git stash`) e rode `--repeat-each=5` no codigo anterior. Se
    // falhar igual, e a flutuacao; se so falhar com a sua mudanca, e a sua.
    await page.waitForTimeout(1500)
    await expect(campoDe(page, 'Valor recebido')).toHaveValue('50')

    await campoDe(page, 'Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Só receber', exact: false }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Parcial', { timeout: 30_000 })
    await expect(page.getByTestId('saldo')).toHaveText('R$ 150,00')
  })

  test('acima do saldo e recusado; estorno volta a nao pago e fica riscado no livro', async ({ page }) => {
    await entrar(page)
    await ordemCom(page, '1 placa 100,00')
    await campoDe(page, 'Valor recebido').fill('100,02')
    await campoDe(page, 'Forma de pagamento').selectOption('pix')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'maior que o saldo a receber (R$ 100,00)' })).toBeVisible({ timeout: 30_000 })

    await campoDe(page, 'Valor recebido').fill('100')
    await page.getByRole('button', { name: 'Concluir e receber' }).click()
    await expect(page.getByTestId('estado-pagamento')).toHaveText('Pago', { timeout: 30_000 })

    await page.getByRole('button', { name: 'Estornar' }).click()
    await campoDe(page, 'Motivo do estorno').fill('valor digitado errado')
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
    await campoDe(page, 'Valor').fill('45,90')
    await campoDe(page, 'Conta').selectOption({ label: '8 · Água' })
    await campoDe(page, 'Histórico').fill(historico)
    await campoDe(page, 'Fornecedor').fill('COPASA')
    // A parcela e excecao e vive fechada num <details>; abrir faz parte do fluxo real.
    await page.getByText('Foi parcelado?').click()
    await campoDe(page, 'Parcela', { exact: true }).fill('2')
    await campoDe(page, 'Total de parcelas').fill('3')
    await page.getByRole('button', { name: 'Lançar saída' }).click()
    await expect(page).toHaveURL(/\/financeiro$/, { timeout: 30_000 })
    const linha = page.getByRole('row').filter({ hasText: historico })
    await expect(linha).toContainText('COPASA')
    await expect(linha).toContainText('parcela 2/3')
    await expect(linha).toContainText('−R$ 45,90')

    await linha.getByRole('button', { name: 'Estornar' }).click()
    await campoDe(linha, 'Motivo do estorno').fill('lançado em duplicidade')
    await linha.getByRole('button', { name: 'Confirmar' }).click()
    await expect(linha).toContainText('estornado · lançado em duplicidade', { timeout: 30_000 })
  })

  test('livro-caixa: atalho de periodo, filtro por tipo e busca mudam os totais junto com a lista', async ({ page }) => {
    await entrar(page)
    const historico = `Solvente ${Date.now()}`
    await page.goto('/financeiro/saida')
    await campoDe(page, 'Valor').fill('137,00')
    await campoDe(page, 'Conta').selectOption({ label: '2 · Material de impressão' })
    await campoDe(page, 'Histórico').fill(historico)
    await page.getByRole('button', { name: 'Lançar saída' }).click()
    await expect(page).toHaveURL(/\/financeiro$/, { timeout: 30_000 })

    // O atalho vira endereco, e o que esta valendo fica marcado.
    await page.getByRole('link', { name: 'Este ano' }).click()
    await expect(page).toHaveURL(/de=\d{4}-01-01&ate=\d{4}-12-31/)
    await expect(page.getByRole('link', { name: 'Este ano' })).toHaveAttribute('aria-current', 'true')

    // A busca precisa recortar a LISTA e os TOTAIS juntos: total que ignora o
    // filtro diz "entradas do mes" sobre uma tela que mostra outra coisa.
    await campoDe(page, 'Buscar').fill(historico)
    await page.getByRole('button', { name: 'Mostrar' }).click()
    await expect(page.getByTestId('saidas')).toContainText('R$ 137,00', { timeout: 30_000 })
    await expect(page.getByTestId('entradas')).toContainText('R$ 0,00')
    await expect(page.getByRole('table', { name: 'Lançamentos' }).getByRole('row')).toHaveCount(2)
  })

  // Contexto proprio: /entrar redireciona quem ja tem sessao, entao trocar de usuario
  // no meio do teste nao funciona. Mesmo formato do teste de Materiais.
  test('operacao nao ve nem abre o Financeiro', async ({ page }) => {
    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Plano de contas' })).toHaveCount(0)
    await page.goto('/financeiro')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
  })

  test('plano de contas: grupos, quem recebe as vendas, criar, desativar e excluir', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Plano de contas' }).click()
    await expect(page).toHaveURL(/\/plano-de-contas$/)
    await expect(page.getByRole('row').filter({ hasText: 'Vendas de serviços' })).toContainText('recebe os pagamentos das ordens')
    // Os grupos sao linhas DENTRO da tabela, e nao um cartao por grupo: quatro
    // cartoes empilhados custavam 1.700px de rolagem para quinze contas.
    const tabela = page.getByRole('table', { name: 'Plano de contas' })
    await expect(tabela.getByRole('row').filter({ hasText: 'Custos da produção' })).toBeVisible()
    await expect(page.getByText('Material de impressão')).toBeVisible()

    const nome = `Marketing digital ${Date.now()}`
    await campoDe(page, 'Nova conta').fill(nome)
    await campoDe(page, 'Tipo').selectOption('despesa')
    await campoDe(page, 'Grupo').fill('Despesas fixas')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    const linha = page.getByRole('row').filter({ hasText: nome })
    await expect(linha).toBeVisible({ timeout: 30_000 })
    await linha.getByRole('button', { name: 'Desativar' }).click()
    await expect(linha).toHaveCount(0, { timeout: 30_000 })
    await page.goto('/plano-de-contas?inativas=1')
    const inativa = page.getByRole('row').filter({ hasText: nome })
    await expect(inativa).toContainText('desativada')

    // Excluir de vez -- e tambem a faxina do proprio teste: sem isto cada
    // rodada deixava uma conta de mentira no plano da loja.
    await inativa.getByRole('button', { name: 'Excluir' }).click()
    await expect(inativa.getByText(`Excluir ${nome}?`)).toBeVisible()
    await inativa.getByRole('button', { name: 'Excluir', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: nome })).toHaveCount(0, { timeout: 30_000 })
  })
})
