# Fase 4 — Dinheiro: recebimento, livro-caixa, plano de contas, a transação única e a fila de trabalho

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O marco em que o legado pode ser desligado: a Odete conclui a ordem e registra o recebimento num botão só, o caixa é lançado na mesma transação, o eixo de pagamento é derivado dos recebimentos, o livro-caixa mostra entradas e saídas contra as 48 contas do legado, e a tela inicial vira a fila de trabalho — abertas paradas há mais de uma semana e concluídas não pagas com o total somado.

**Architecture:** O eixo de pagamento **nunca é gravado**: é derivado, na leitura, da soma dos recebimentos não estornados contra `preco_final` (`resumirPagamento`, domínio puro). Cada recebimento nasce colado a um `LancamentoCaixa` de entrada (`recebimento.lancamento_id` único) — os dois são criados na mesma `executarUmaVez`, com a trava de `versao` da ordem e a chave de idempotência; "Concluir e receber" é a mesma transação com a transição `aberta → concluida` dentro. Nada é apagado: recebimento e lançamento errados são **estornados** (com motivo, quem e quando) e continuam no livro riscados. A fila de trabalho é uma classificação pura sobre uma lista serializável (`classificarFila`), alimentada por uma query com `groupBy` dos recebimentos. As telas seguem o padrão da Fase 3: Server Components para tabelas e painéis, Client Components só para formulários, `iniciar(() => router.refresh())` no sucesso, `revalidatePath` na action.

**Tech Stack:** o mesmo da Fase 3. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-27-sistema-drusign-design.md` (seções 2, 4 — Recebimento, ContaPlano, LancamentoCaixa —, 6, 7 — telas 1, 3, 6, 10 e 11 —, 9, 10 — plano de contas — e 13)

## Global Constraints

- Dinheiro em `Decimal` no domínio, `numeric(12,4)` no banco, **string decimal** na fronteira cliente→action; nunca `Number(prismaDecimal)`; conversão só por `paraDominio`/`paraBanco`.
- Nada em `src/domain/` importa framework, banco ou infra (trava de pureza `src/domain/pureza.test.ts`).
- **Nada de `DELETE`** em dado de negócio: recebimento e lançamento errados ganham `estornado_em`, `estornado_por_id` e `motivo_estorno`; conta do plano desativa, não some.
- **Transação única** (spec, seção 9): concluir a ordem, registrar o recebimento e lançar no caixa acontecem numa `executarUmaVez` só. Ou tudo, ou nada. Sem sucesso otimista: o retorno vem depois do commit.
- **Eixo de pagamento derivado** (spec, seção 6): `nao_pago | parcial | pago` calculado da soma dos recebimentos vivos contra `preco_final`; nunca digitado, nunca coluna editável.
- Toda mutação de dinheiro carrega `versao` da ordem (trava otimista) e chave de idempotência (`crypto.randomUUID()` no cliente, uma por tentativa).
- **Forma de pagamento obrigatória e sem valor de fábrica** (spec, seções 4 e 7): o `<select>` começa em "Escolha a forma"; "Avista" era o valor de fábrica em 99,5% do legado e não existe aqui.
- Toda tabela carrega `empresa_id`; toda leitura e escrita filtra por `empresa_id` do usuário logado.
- Financeiro, plano de contas e estorno são de `administracao`; concluir ("Serviço finalizado") é dos dois papéis.
- TypeScript 7 (sem `baseUrl`; `it.each` declara todos os elementos); Postgres local sem shadow: migrar com `npm run db:migrar -- <nome>`; comandos de shell curtos; arquivo com barra dupla nunca sai de heredoc; `rtk` intercepta `ls`, `grep` e `npx prisma` — use `find`, o Grep tool e `node node_modules/prisma/build/index.js`.
- O `prisma dev` local aceita poucas conexões simultâneas: `DATABASE_POOL_MAX=2` no `.env.local`; se aparecer `Connection terminated unexpectedly`, reiniciar o daemon (`npx prisma dev stop drusign && npm run db:local`).

## O que este plano decide (29/08/2026)

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde mora o eixo de pagamento | derivado na leitura: `resumirPagamento(precoFinal, recebimentosVivos)` → `{ totalRecebido, saldo, estado }`; `groupBy` de recebimentos por ordem nas listas | a spec proíbe coluna editável; persistir um cache "total_recebido" criaria a segunda fonte de verdade que o legado tinha (`SALDO` do CAIXA está em -1.946,45 no 6º registro) |
| Recebimento ↔ caixa | `recebimento.lancamento_id` **único e obrigatório**; os dois nascem na mesma transação; o estorno marca os dois | "registrar recebimento e lançar no caixa nunca são operações separadas" (spec, seção 6); no legado eram telas diferentes e 372 ordens nunca viraram título |
| Conta do recebimento | `empresa.conta_recebimento_id` (FK para `conta_plano`), definida pela importação (código 1, VENDAS DIVERSAS — 14.692 de 14.692 títulos do legado) e editável no plano de contas; sem ela, receber recusa com mensagem | um `<select>` de conta no balcão seria campo que ninguém troca; a regra da spec proíbe |
| Formas de pagamento | enum `forma_pagamento`: `dinheiro, pix, cartao_debito, cartao_credito, transferencia, cheque, boleto`; sem "Avista" | o `FORMA.DBF` tem 11 linhas com duplicatas ("9" = Avista e NOTA A PRAZO; "10" = Boleto e pix); Avista é 98,5% porque era o valor de fábrica; a spec exige forma com significado |
| "Concluir e receber" | um botão, uma action, uma transação (`registrarRecebimento(…, { concluir: true })`); em ordem já `concluida` o botão é só "Receber"; "Serviço finalizado" separado não toca em dinheiro | spec, seção 6: atalho, não terceiro estado; quem já teve o serviço finalizado vê apenas "Receber" |
| Recebimento parcial e limite | aceita parcial; recusa valor acima do saldo (tolerância de R$ 0,01) e recusa em `orcamento` (aprove antes) e `cancelada` | conserta as 12 ordens fatiadas do Instituto de Oncologia; pagamento a mais é erro de digitação, não troco |
| Erro de dinheiro | **estorno**, nunca edição nem exclusão: `estornado_em/por/motivo` no recebimento e no lançamento, na mesma transação, com `versao`; o livro mostra riscado | a spec proíbe DELETE; editar valor de recebimento apagaria a história |
| Saídas (despesas) | `registrarSaida` com conta de tipo `despesa`, histórico, fornecedor em texto livre, `parcela/total_parcelas` opcionais | spec, seção 4: parcela fica na saída (43,4% das despesas do legado trazem `2/3` no texto); contas a pagar está fora de escopo |
| Plano de contas | importar as 48 contas do `CONTAS.DBF` como estão (`codigo`, `nome`, `nivel`, `tipo`, `grupo` = `NOMENIVEL`); criar conta nova; desativar; nunca apagar | "importar como estão, incluindo as contas pessoais dos sócios" (spec, seção 4); os grupos reais são **6** (CUSTO GERAL 16, DESPESAS 15, CUSTO FINANCEIRO 7, DESPESAS COM VEICULO 4, RECEITA GERAL 3, COMPRAS 3) — a spec fala em 5; o plano segue o dado |
| Fila de trabalho | `classificarFila(ordens, agora)`: **paradas** = `aberta` há mais de 7 dias (mais antiga primeiro); **a cobrar** = `concluida` com estado de pagamento ≠ `pago` (concluída há mais tempo primeiro), com o total do saldo somado; busca redireciona para `/ordens?q=` | spec, tela 1: "duas listas … com o total somado. Não é dashboard" |
| Lista de ordens | filtros `q` (número, nome, apelido), `estado`, `de`/`ate` (aberta em), por GET; cada linha mostra os dois eixos | spec, tela 3 |
| Data do recebimento | `@db.Date`, digitada, padrão **hoje** (America/Sao_Paulo) — é pré-seleção com significado | dinheiro que entra hoje é o caso de 100% do balcão; recebimento retroativo é o motivo do campo existir |
| Quem pode | receber, estornar, financeiro e plano de contas: `administracao` (a Odete é administração no sistema de dois papéis); concluir: qualquer papel | spec, seção 3: produção só marca serviço finalizado |
| Escopo | `/` (fila), `/ordens` (filtros e eixo de pagamento), `/ordens/[id]` (painel de pagamento), `/financeiro`, `/financeiro/saida`, `/plano-de-contas`, importação do plano | recibo impresso, relatório do contador (Fase 6), fila de produção e dashboard (Fase 5), transferência entre caixas (fora de escopo) ficam fora |

**Fatos do legado usados aqui:** `CONTAS.DBF` = 48 contas (`CONTA`, `NOME`, `NIVEL`, `TIPO` R/D, `NOMENIVEL`), 3 receitas (1 VENDAS DIVERSAS, 31 DEPOSITO, 36 SERILON) e 45 despesas; nomes com acento em CP1252 ("MANUTENÇÃO DO VEÍCULO"). `RECEBER.DBF` = 14.817 títulos vivos, `CODCTA` = 1 em 14.692, `PARCELAS` = 1 em 14.689, `FORMA` = "Avista" em 14.604. `CAIXA.DBF` = 27.803 lançamentos (R 14.695, D 13.108), um caixa só em 99,94%. `PAGAR.DBF` = 24 títulos de 2012 (contas a pagar, fora de escopo).

---

### Task 1: Domínio — pagamento derivado, formas, validações, histórico, fila e plano de contas

**Files:**
- Modify: `src/domain/ordem/estados.ts` (`calcularEstadoPagamento` aceita string; `permissoes` ganha `concluir` e `receber`), `src/domain/ordem/estados.test.ts` (acrescenta)
- Create: `src/domain/caixa/formas.ts`, `src/domain/caixa/pagamento.ts`, `src/domain/caixa/lancamento.ts`, `src/domain/caixa/fila.ts`, `src/domain/caixa/plano.ts`
- Test: `src/domain/caixa/pagamento.test.ts`, `src/domain/caixa/lancamento.test.ts`, `src/domain/caixa/fila.test.ts`, `src/domain/caixa/plano.test.ts`

**Interfaces:**
- Consumes: `dinheiro`, `arredondarCentavos`, `Decimal` (`src/domain/precificacao/dinheiro.ts`); `ErroDeValidacao`; `ValorNumerico`; `EstadoProducao`, `EstadoPagamento`; `lerDataCalendario` (`src/domain/ordem/datas.ts`, devolve `Date | null` para `'AAAA-MM-DD'`); `formatarMoeda`.
- Produces:
  - `FORMAS_PAGAMENTO`, `type FormaPagamento`, `ROTULO_FORMA`, `ehFormaPagamento(v): v is FormaPagamento`
  - `calcularEstadoPagamento(precoFinal: ValorNumerico, recebimentos: ValorNumerico[]): EstadoPagamento`
  - `resumirPagamento(precoFinal, recebimentos): ResumoPagamento = { totalRecebido: Decimal; saldo: Decimal; estado: EstadoPagamento }`, `ROTULO_PAGAMENTO`
  - `validarRecebimento(dados: { valor: string; forma: string; data: string }, situacao: { precoFinal: ValorNumerico; totalRecebido: ValorNumerico; estadoProducao: EstadoProducao }): RecebimentoValidado = { valor: Decimal; forma: FormaPagamento; data: Date }` — lança `ErroDeValidacao`
  - `type TipoConta = 'receita' | 'despesa'`, `type TipoLancamento = 'entrada' | 'saida'`, `ROTULO_TIPO_CONTA`, `validarSaida(dados: { valor: string; data: string; historico: string; parcela: string; totalParcelas: string }, conta: { tipo: TipoConta; ativa: boolean }): SaidaValidada = { valor: Decimal; data: Date; historico: string; parcela: number | null; totalParcelas: number | null }`, `historicoDeRecebimento(numero, clienteNome, clienteApelido, forma): string`, `formatarNumeroOs(numero): string`
  - `interface OrdemDaFila { id; numero; clienteNome; clienteApelido; estadoProducao; abertaEm: string; concluidaEm: string | null; prometidaPara: string | null; precoFinal: string; totalRecebido: string }`, `classificarFila(ordens: OrdemDaFila[], agora: Date, diasParada = 7): Fila = { paradas: OrdemDaFila[]; aCobrar: Array<OrdemDaFila & { saldo: string }>; totalACobrar: string }`
  - `interface ContaLegado { codigo: number; nome: string; nivel: number; tipo: TipoConta; grupo: string }`, `converterContaLegado(valores: Record<string, string | number | null>): ContaLegado`
  - `permissoes(estado)` ganha `concluir: boolean` (só `aberta`) e `receber: boolean` (`aberta` ou `concluida`)

- [x] **Step 1: Formas de pagamento e o eixo derivado (testes)**

`src/domain/caixa/pagamento.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resumirPagamento, validarRecebimento, ROTULO_PAGAMENTO } from './pagamento'
import { FORMAS_PAGAMENTO, ehFormaPagamento, ROTULO_FORMA } from './formas'

describe('formas de pagamento', () => {
  it('sao sete, sem Avista, e cada uma tem rotulo', () => {
    expect(FORMAS_PAGAMENTO).toEqual(['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'boleto'])
    for (const f of FORMAS_PAGAMENTO) expect(ROTULO_FORMA[f]).toBeTruthy()
    expect(ehFormaPagamento('pix')).toBe(true)
    expect(ehFormaPagamento('avista')).toBe(false)
    expect(ehFormaPagamento('')).toBe(false)
  })
})

describe('resumirPagamento', () => {
  it('deriva total, saldo e estado da soma dos recebimentos (strings exatas)', () => {
    const r = resumirPagamento('2528.00', ['1000.00', '528.00'])
    expect(r.totalRecebido.toFixed(2)).toBe('1528.00')
    expect(r.saldo.toFixed(2)).toBe('1000.00')
    expect(r.estado).toBe('parcial')
  })
  it.each([
    ['150.00', [], 'nao_pago', '150.00'],
    ['150.00', ['150.00'], 'pago', '0.00'],
    ['150.00', ['149.99'], 'pago', '0.01'],
    ['150.00', ['149.98'], 'parcial', '0.02'],
    ['0.00', [], 'pago', '0.00'],
  ] as const)('preco %s recebido %j -> %s (saldo %s)', (preco, recebidos, estado, saldo) => {
    const r = resumirPagamento(preco, [...recebidos])
    expect(r.estado).toBe(estado)
    expect(r.saldo.toFixed(2)).toBe(saldo)
  })
  it('saldo nunca fica negativo', () => {
    expect(resumirPagamento('100.00', ['100.00', '5.00']).saldo.toFixed(2)).toBe('0.00')
  })
  it('tem rotulo para os tres estados', () => {
    expect(ROTULO_PAGAMENTO).toEqual({ nao_pago: 'Não pago', parcial: 'Parcial', pago: 'Pago' })
  })
})

describe('validarRecebimento', () => {
  const situacao = { precoFinal: '150.00', totalRecebido: '0.00', estadoProducao: 'aberta' as const }
  it('aceita valor como a Odete digita, forma valida e data do calendario', () => {
    const r = validarRecebimento({ valor: '150,00', forma: 'pix', data: '2026-08-29' }, situacao)
    expect(r.valor.toFixed(2)).toBe('150.00')
    expect(r.forma).toBe('pix')
    expect(r.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
  })
  it('aceita parcial e recusa acima do saldo (tolerancia de um centavo)', () => {
    expect(validarRecebimento({ valor: '80', forma: 'dinheiro', data: '2026-08-29' }, situacao).valor.toFixed(2)).toBe('80.00')
    expect(validarRecebimento({ valor: '150,01', forma: 'dinheiro', data: '2026-08-29' }, situacao).valor.toFixed(2)).toBe('150.01')
    expect(() => validarRecebimento({ valor: '150,02', forma: 'dinheiro', data: '2026-08-29' }, situacao)).toThrow(/maior que o saldo a receber \(R\$ 150,00\)/)
    expect(() => validarRecebimento({ valor: '100', forma: 'pix', data: '2026-08-29' }, { ...situacao, totalRecebido: '80.00' })).toThrow(/R\$ 70,00/)
  })
  it.each([
    [{ valor: '', forma: 'pix', data: '2026-08-29' }, /valor/],
    [{ valor: '0', forma: 'pix', data: '2026-08-29' }, /maior que zero/],
    [{ valor: 'abc', forma: 'pix', data: '2026-08-29' }, /valor/],
    [{ valor: '10', forma: '', data: '2026-08-29' }, /escolha a forma de pagamento/],
    [{ valor: '10', forma: 'avista', data: '2026-08-29' }, /escolha a forma de pagamento/],
    [{ valor: '10', forma: 'pix', data: '29/08/2026' }, /data/],
    [{ valor: '10', forma: 'pix', data: '' }, /data/],
  ])('recusa %j', (dados, erro) => {
    expect(() => validarRecebimento(dados, situacao)).toThrow(erro)
  })
  it('recusa por estado: orcamento, cancelada e ordem sem valor', () => {
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, estadoProducao: 'orcamento' })).toThrow(/aprove o orçamento/)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, estadoProducao: 'cancelada' })).toThrow(/cancelada/)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, precoFinal: '0.00' })).toThrow(/não tem valor a receber/)
    expect(() => validarRecebimento({ valor: '10', forma: 'pix', data: '2026-08-29' }, { ...situacao, totalRecebido: '150.00' })).toThrow(/já está paga/)
  })
})
```

Run: `npm test -- src/domain/caixa/pagamento` → vermelho (`Cannot find module './pagamento'`).

- [x] **Step 2: Formas e pagamento (implementação)**

`src/domain/caixa/formas.ts`:
```ts
/** Sem "Avista": era o valor de fabrica em 98,5% dos titulos do legado e nao significa nada (spec, secao 7). */
export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'boleto'] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de débito',
  cartao_credito: 'Cartão de crédito',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  boleto: 'Boleto',
}

export function ehFormaPagamento(v: string): v is FormaPagamento {
  return (FORMAS_PAGAMENTO as readonly string[]).includes(v)
}
```

`src/domain/caixa/pagamento.ts`:
```ts
import { dinheiro, arredondarCentavos, type Decimal } from '../precificacao/dinheiro'
import { interpretarMoeda, formatarMoeda } from '../precificacao/moeda'
import { ErroDeValidacao } from '../precificacao/erros'
import type { ValorNumerico } from '../precificacao/tipos'
import { calcularEstadoPagamento, type EstadoPagamento, type EstadoProducao } from '../ordem/estados'
import { lerDataCalendario } from '../ordem/datas'
import { ehFormaPagamento, type FormaPagamento } from './formas'

export interface ResumoPagamento {
  totalRecebido: Decimal
  /** Quanto falta; nunca negativo. */
  saldo: Decimal
  estado: EstadoPagamento
}

export const ROTULO_PAGAMENTO: Record<EstadoPagamento, string> = { nao_pago: 'Não pago', parcial: 'Parcial', pago: 'Pago' }

/** O eixo de pagamento e derivado daqui e so daqui (spec, secao 6). */
export function resumirPagamento(precoFinal: ValorNumerico, recebimentos: ValorNumerico[]): ResumoPagamento {
  const total = dinheiro(precoFinal)
  const totalRecebido = recebimentos.reduce((s, r) => s.plus(dinheiro(r)), dinheiro(0))
  const saldo = Decimal.max(total.minus(totalRecebido), 0)
  return { totalRecebido: arredondarCentavos(totalRecebido), saldo: arredondarCentavos(saldo), estado: calcularEstadoPagamento(precoFinal, recebimentos) }
}

export interface DadosRecebimentoDigitado {
  /** Como a Odete digita: "150", "150,00", "1.200,00". */
  valor: string
  forma: string
  /** 'AAAA-MM-DD' do <input type="date">. */
  data: string
}

export interface SituacaoDaOrdem {
  precoFinal: ValorNumerico
  totalRecebido: ValorNumerico
  estadoProducao: EstadoProducao
}

export interface RecebimentoValidado {
  valor: Decimal
  forma: FormaPagamento
  data: Date
}

const TOLERANCIA = dinheiro('0.01')

export function validarRecebimento(dados: DadosRecebimentoDigitado, s: SituacaoDaOrdem): RecebimentoValidado {
  if (s.estadoProducao === 'orcamento') throw new ErroDeValidacao('aprove o orçamento antes de receber')
  if (s.estadoProducao === 'cancelada') throw new ErroDeValidacao('ordem cancelada não recebe')
  const preco = dinheiro(s.precoFinal)
  if (preco.lte(0)) throw new ErroDeValidacao('a ordem não tem valor a receber')
  const saldo = preco.minus(dinheiro(s.totalRecebido))
  if (saldo.lte(0)) throw new ErroDeValidacao('a ordem já está paga')

  const valor = interpretarMoeda(dados.valor)
  if (valor === null) throw new ErroDeValidacao('informe o valor recebido')
  if (valor.lte(0)) throw new ErroDeValidacao('o valor precisa ser maior que zero')
  if (valor.gt(saldo.plus(TOLERANCIA))) throw new ErroDeValidacao(`valor maior que o saldo a receber (${formatarMoeda(saldo)})`)
  if (!ehFormaPagamento(dados.forma)) throw new ErroDeValidacao('escolha a forma de pagamento')
  const data = lerDataCalendario(dados.data)
  if (!data) throw new ErroDeValidacao('data do recebimento inválida')
  return { valor: arredondarCentavos(valor), forma: dados.forma, data }
}
```

Em `src/domain/ordem/estados.ts`, trocar a assinatura de `calcularEstadoPagamento` para strings ou números (o `dinheiro()` já aceita os dois) e acrescentar as duas permissões:
```ts
import type { ValorNumerico } from '../precificacao/tipos'
// ...
export function calcularEstadoPagamento(
  precoFinal: ValorNumerico,
  recebimentos: ValorNumerico[],
): EstadoPagamento {
```
e em `PermissoesOrdem`/`permissoes`:
```ts
  /** "Servico finalizado": so de aberta; nao toca em dinheiro. */
  concluir: boolean
  /** Receber (e "Concluir e receber" quando ainda aberta). */
  receber: boolean
// ...
    concluir: estado === 'aberta',
    receber: estado === 'aberta' || estado === 'concluida',
```
Em `src/domain/ordem/estados.test.ts`, acrescentar dentro do `describe` de `calcularEstadoPagamento`:
```ts
  it('aceita strings decimais exatas', () => {
    expect(calcularEstadoPagamento('2528.00', ['2528.00'])).toBe('pago')
    expect(calcularEstadoPagamento('2528.00', ['1000.00', '1527.99'])).toBe('pago')
    expect(calcularEstadoPagamento('2528.00', ['1000.00', '1527.98'])).toBe('parcial')
  })
```
e, no bloco de `permissoes` (se existir; senão criar um `describe('permissoes')`):
```ts
  it('concluir so em aberta; receber em aberta e concluida', () => {
    expect(permissoes('aberta')).toMatchObject({ concluir: true, receber: true })
    expect(permissoes('concluida')).toMatchObject({ concluir: false, receber: true })
    expect(permissoes('orcamento')).toMatchObject({ concluir: false, receber: false })
    expect(permissoes('cancelada')).toMatchObject({ concluir: false, receber: false })
  })
```

Run: `npm test -- src/domain/caixa/pagamento src/domain/ordem/estados` → PASS.

- [x] **Step 3: Lançamento — saída validada, histórico do recebimento, número da OS (testes)**

`src/domain/caixa/lancamento.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validarSaida, historicoDeRecebimento, formatarNumeroOs, ROTULO_TIPO_CONTA } from './lancamento'

const despesa = { tipo: 'despesa' as const, ativa: true }

describe('validarSaida', () => {
  it('aceita valor, data, historico e parcela como a Odete digita', () => {
    const s = validarSaida({ valor: '1.358,81', data: '2026-08-29', historico: '  Chapa ACM, Solvente ', parcela: '2', totalParcelas: '3' }, despesa)
    expect(s.valor.toFixed(2)).toBe('1358.81')
    expect(s.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
    expect(s.historico).toBe('Chapa ACM, Solvente')
    expect(s).toMatchObject({ parcela: 2, totalParcelas: 3 })
  })
  it('parcela vazia e null; parcela sem total assume 1/1; total sem parcela e recusado', () => {
    expect(validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, despesa)).toMatchObject({ parcela: null, totalParcelas: null })
    expect(validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '1', totalParcelas: '' }, despesa)).toMatchObject({ parcela: 1, totalParcelas: 1 })
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '4', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
    expect(() => validarSaida({ valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '0', totalParcelas: '3' }, despesa)).toThrow(/parcela/)
  })
  it.each([
    [{ valor: '', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, /valor/],
    [{ valor: '0', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }, /maior que zero/],
    [{ valor: '10', data: '', historico: 'Agua', parcela: '', totalParcelas: '' }, /data/],
    [{ valor: '10', data: '2026-08-29', historico: '   ', parcela: '', totalParcelas: '' }, /histórico/],
  ])('recusa %j', (dados, erro) => {
    expect(() => validarSaida(dados, despesa)).toThrow(erro)
  })
  it('recusa conta de receita e conta desativada', () => {
    const dados = { valor: '10', data: '2026-08-29', historico: 'Agua', parcela: '', totalParcelas: '' }
    expect(() => validarSaida(dados, { tipo: 'receita', ativa: true })).toThrow(/conta de despesa/)
    expect(() => validarSaida(dados, { tipo: 'despesa', ativa: false })).toThrow(/desativada/)
  })
})

describe('historicoDeRecebimento', () => {
  it('OS com apelido, sem apelido e venda de balcao', () => {
    expect(historicoDeRecebimento(18461, 'Associação de Ensino e Pesquisa de Unaí', 'FACTU', 'pix')).toBe('OS 018461 · FACTU · Pix')
    expect(historicoDeRecebimento(18461, 'Helio da Silva Mota', null, 'dinheiro')).toBe('OS 018461 · Helio da Silva Mota · Dinheiro')
    expect(historicoDeRecebimento(18461, null, null, 'cartao_credito')).toBe('OS 018461 · Venda de balcão · Cartão de crédito')
  })
  it('formatarNumeroOs preenche seis digitos', () => {
    expect(formatarNumeroOs(18461)).toBe('018461')
    expect(formatarNumeroOs(1)).toBe('000001')
  })
  it('rotulos de tipo de conta', () => {
    expect(ROTULO_TIPO_CONTA).toEqual({ receita: 'Receita', despesa: 'Despesa' })
  })
})
```

Run: `npm test -- src/domain/caixa/lancamento` → vermelho.

- [x] **Step 4: Lançamento (implementação)**

`src/domain/caixa/lancamento.ts`:
```ts
import { arredondarCentavos, type Decimal } from '../precificacao/dinheiro'
import { interpretarMoeda } from '../precificacao/moeda'
import { ErroDeValidacao } from '../precificacao/erros'
import { lerDataCalendario } from '../ordem/datas'
import { ROTULO_FORMA, type FormaPagamento } from './formas'

export type TipoConta = 'receita' | 'despesa'
export type TipoLancamento = 'entrada' | 'saida'

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = { receita: 'Receita', despesa: 'Despesa' }
export const ROTULO_TIPO_LANCAMENTO: Record<TipoLancamento, string> = { entrada: 'Entrada', saida: 'Saída' }

export interface DadosSaidaDigitada {
  valor: string
  data: string
  historico: string
  /** Vazio quando nao parcelado. A parcela fica na saida, nao na venda (spec, secao 4). */
  parcela: string
  totalParcelas: string
}

export interface SaidaValidada {
  valor: Decimal
  data: Date
  historico: string
  parcela: number | null
  totalParcelas: number | null
}

function inteiroOuNull(texto: string, rotulo: string): number | null {
  const t = texto.trim()
  if (t === '') return null
  if (!/^\d{1,2}$/.test(t) || Number(t) === 0) throw new ErroDeValidacao(`${rotulo} inválida`)
  return Number(t)
}

export function validarSaida(dados: DadosSaidaDigitada, conta: { tipo: TipoConta; ativa: boolean }): SaidaValidada {
  if (conta.tipo !== 'despesa') throw new ErroDeValidacao('saída pede uma conta de despesa')
  if (!conta.ativa) throw new ErroDeValidacao('esta conta está desativada')
  const valor = interpretarMoeda(dados.valor)
  if (valor === null) throw new ErroDeValidacao('informe o valor')
  if (valor.lte(0)) throw new ErroDeValidacao('o valor precisa ser maior que zero')
  const data = lerDataCalendario(dados.data)
  if (!data) throw new ErroDeValidacao('data inválida')
  const historico = dados.historico.trim().replace(/\s+/g, ' ').slice(0, 160)
  if (historico === '') throw new ErroDeValidacao('descreva o histórico')
  const parcela = inteiroOuNull(dados.parcela, 'parcela')
  let totalParcelas = inteiroOuNull(dados.totalParcelas, 'quantidade de parcelas')
  if (parcela === null && totalParcelas !== null) throw new ErroDeValidacao('informe a parcela (ex.: 2 de 3)')
  if (parcela !== null && totalParcelas === null) totalParcelas = 1
  if (parcela !== null && totalParcelas !== null && parcela > totalParcelas) throw new ErroDeValidacao('parcela maior que o total de parcelas')
  return { valor: arredondarCentavos(valor), data, historico, parcela, totalParcelas }
}

export function formatarNumeroOs(numero: number): string {
  return String(numero).padStart(6, '0')
}

/** O que aparece no livro-caixa: "OS 018461 · FACTU · Pix". */
export function historicoDeRecebimento(numero: number, clienteNome: string | null, clienteApelido: string | null, forma: FormaPagamento): string {
  const quem = clienteApelido || clienteNome || 'Venda de balcão'
  return `OS ${formatarNumeroOs(numero)} · ${quem} · ${ROTULO_FORMA[forma]}`
}
```

Run: `npm test -- src/domain/caixa/lancamento` → PASS.

- [x] **Step 5: A fila de trabalho (testes)**

`src/domain/caixa/fila.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classificarFila, type OrdemDaFila } from './fila'

const agora = new Date('2026-08-29T15:00:00.000Z')
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString()

function ordem(p: Partial<OrdemDaFila> & { numero: number }): OrdemDaFila {
  return {
    id: `id-${p.numero}`, clienteNome: null, clienteApelido: null, estadoProducao: 'aberta',
    abertaEm: dias(0), concluidaEm: null, prometidaPara: null, precoFinal: '100.00', totalRecebido: '0.00', ...p,
  }
}

describe('classificarFila', () => {
  it('paradas: abertas ha mais de 7 dias, a mais antiga primeiro; orcamento e recente ficam fora', () => {
    const fila = classificarFila([
      ordem({ numero: 1, abertaEm: dias(8) }),
      ordem({ numero: 2, abertaEm: dias(30) }),
      ordem({ numero: 3, abertaEm: dias(6) }),
      ordem({ numero: 4, abertaEm: dias(40), estadoProducao: 'orcamento' }),
      ordem({ numero: 5, abertaEm: dias(7) }),
    ], agora)
    expect(fila.paradas.map((o) => o.numero)).toEqual([2, 1])
  })
  it('a cobrar: concluidas nao pagas com o saldo, a concluida ha mais tempo primeiro, e o total somado', () => {
    const fila = classificarFila([
      ordem({ numero: 10, estadoProducao: 'concluida', concluidaEm: dias(2), precoFinal: '300.00', totalRecebido: '100.00' }),
      ordem({ numero: 11, estadoProducao: 'concluida', concluidaEm: dias(5), precoFinal: '2528.00' }),
      ordem({ numero: 12, estadoProducao: 'concluida', concluidaEm: dias(1), precoFinal: '50.00', totalRecebido: '50.00' }),
      ordem({ numero: 13, estadoProducao: 'concluida', concluidaEm: dias(1), precoFinal: '80.00', totalRecebido: '79.99' }),
      ordem({ numero: 14, estadoProducao: 'cancelada', concluidaEm: dias(1), precoFinal: '80.00' }),
    ], agora)
    expect(fila.aCobrar.map((o) => [o.numero, o.saldo])).toEqual([[11, '2528.00'], [10, '200.00']])
    expect(fila.totalACobrar).toBe('2728.00')
  })
  it('fila vazia', () => {
    expect(classificarFila([], agora)).toEqual({ paradas: [], aCobrar: [], totalACobrar: '0.00' })
  })
  it('aceita outro limite de dias', () => {
    expect(classificarFila([ordem({ numero: 1, abertaEm: dias(3) })], agora, 2).paradas).toHaveLength(1)
  })
})
```

Run: `npm test -- src/domain/caixa/fila` → vermelho.

- [x] **Step 6: A fila (implementação)**

`src/domain/caixa/fila.ts`:
```ts
import { dinheiro } from '../precificacao/dinheiro'
import type { EstadoProducao } from '../ordem/estados'
import { resumirPagamento } from './pagamento'

/** Serializavel: e o que a infra monta com um groupBy de recebimentos e a tela recebe pronto. */
export interface OrdemDaFila {
  id: string
  numero: number
  clienteNome: string | null
  clienteApelido: string | null
  estadoProducao: EstadoProducao
  abertaEm: string
  concluidaEm: string | null
  prometidaPara: string | null
  precoFinal: string
  totalRecebido: string
}

export interface Fila {
  /** Abertas ha mais de `diasParada` dias, a mais antiga primeiro. */
  paradas: OrdemDaFila[]
  /** Concluidas e nao pagas, a concluida ha mais tempo primeiro, com o saldo de cada uma. */
  aCobrar: Array<OrdemDaFila & { saldo: string }>
  totalACobrar: string
}

const DIA_MS = 86_400_000

/** A tela inicial (spec, tela 1): duas listas, o total somado, nada de grafico. */
export function classificarFila(ordens: OrdemDaFila[], agora: Date, diasParada = 7): Fila {
  const limite = agora.getTime() - diasParada * DIA_MS
  const paradas = ordens
    .filter((o) => o.estadoProducao === 'aberta' && new Date(o.abertaEm).getTime() < limite)
    .sort((a, b) => a.abertaEm.localeCompare(b.abertaEm))

  const aCobrar = ordens
    .filter((o) => o.estadoProducao === 'concluida')
    .map((o) => ({ o, resumo: resumirPagamento(o.precoFinal, [o.totalRecebido]) }))
    .filter(({ resumo }) => resumo.estado !== 'pago')
    .sort((a, b) => (a.o.concluidaEm ?? '').localeCompare(b.o.concluidaEm ?? ''))
    .map(({ o, resumo }) => ({ ...o, saldo: resumo.saldo.toFixed(2) }))

  const totalACobrar = aCobrar.reduce((s, o) => s.plus(dinheiro(o.saldo)), dinheiro(0)).toFixed(2)
  return { paradas, aCobrar, totalACobrar }
}
```

Run: `npm test -- src/domain/caixa/fila` → PASS.

- [x] **Step 7: Plano de contas do legado (teste e implementação)**

`src/domain/caixa/plano.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { converterContaLegado } from './plano'

describe('converterContaLegado', () => {
  it('le CONTA, NOME, NIVEL, TIPO e NOMENIVEL como estao', () => {
    expect(converterContaLegado({ CONTA: 1, NOME: 'VENDAS DIVERSAS', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'RECEITA GERAL', OBS: '' }))
      .toEqual({ codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' })
    expect(converterContaLegado({ CONTA: 24, NOME: 'ODETE   - PESSOAL', NIVEL: 0, TIPO: 'D', NOMENIVEL: 'COMPRAS', OBS: '' }))
      .toEqual({ codigo: 24, nome: 'ODETE   - PESSOAL', nivel: 0, tipo: 'despesa', grupo: 'COMPRAS' })
  })
  it('recusa codigo ausente, tipo desconhecido e nome vazio', () => {
    expect(() => converterContaLegado({ CONTA: null, NOME: 'X', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'G' })).toThrow(/codigo/)
    expect(() => converterContaLegado({ CONTA: 1, NOME: 'X', NIVEL: 1, TIPO: 'Z', NOMENIVEL: 'G' })).toThrow(/tipo/)
    expect(() => converterContaLegado({ CONTA: 1, NOME: '  ', NIVEL: 1, TIPO: 'R', NOMENIVEL: 'G' })).toThrow(/nome/)
  })
  it('grupo vazio vira "SEM GRUPO" e nivel ausente vira 0', () => {
    expect(converterContaLegado({ CONTA: 9, NOME: 'DARF', NIVEL: null, TIPO: 'D', NOMENIVEL: '' })).toMatchObject({ nivel: 0, grupo: 'SEM GRUPO' })
  })
})
```

`src/domain/caixa/plano.ts`:
```ts
import type { TipoConta } from './lancamento'

export interface ContaLegado {
  codigo: number
  nome: string
  nivel: number
  tipo: TipoConta
  /** NOMENIVEL do legado: CUSTO GERAL, DESPESAS, CUSTO FINANCEIRO, DESPESAS COM VEICULO, RECEITA GERAL, COMPRAS. */
  grupo: string
}

export const GRUPO_PADRAO = 'SEM GRUPO'

/** As 48 contas entram como estao, inclusive as pessoais dos socios (spec, secao 4). */
export function converterContaLegado(v: Record<string, string | number | null>): ContaLegado {
  const codigo = typeof v.CONTA === 'number' ? v.CONTA : Number(v.CONTA)
  if (!Number.isInteger(codigo) || codigo <= 0) throw new Error(`conta sem codigo: ${JSON.stringify(v)}`)
  const nome = String(v.NOME ?? '').trim()
  if (nome === '') throw new Error(`conta ${codigo} sem nome`)
  const tipo = v.TIPO === 'R' ? 'receita' : v.TIPO === 'D' ? 'despesa' : null
  if (tipo === null) throw new Error(`conta ${codigo}: tipo desconhecido "${String(v.TIPO)}"`)
  const nivel = typeof v.NIVEL === 'number' && Number.isInteger(v.NIVEL) ? v.NIVEL : 0
  const grupo = String(v.NOMENIVEL ?? '').trim() || GRUPO_PADRAO
  return { codigo, nome, nivel, tipo, grupo }
}
```

Run: `npm test -- src/domain/caixa/plano` → PASS. Run: `npm test` → PASS incluindo `pureza` (nada em `src/domain/caixa` importa infra). Run: `npm run typecheck` → sem erros.

- [x] **Step 8: Commit**

```bash
git add src/domain/caixa src/domain/ordem/estados.ts src/domain/ordem/estados.test.ts
git commit -m "feat: dominio do dinheiro - pagamento derivado, formas, saida validada, fila de trabalho e plano de contas do legado"
```

**Executado (29/08/2026).** 262 unitarios verdes (eram 224), typecheck limpo, `pureza.test.ts`
continua passando — nada em `src/domain/caixa` importa infra. Um desvio do codigo do plano:
`pagamento.ts` importa `Decimal` como valor, nao `type Decimal`, porque usa `Decimal.max`;
o `dinheiro.ts` ja exporta a classe. Sem outras mudancas.

---
### Task 2: Schema — conta do plano, recebimento colado ao lançamento, migração e a importação das 48 contas

**Files:**
- Modify: `prisma/schema.prisma` (enums `FormaPagamento`, `TipoConta`, `TipoLancamento`; models `ContaPlano`, `Recebimento`, `LancamentoCaixa`; campos novos em `Empresa`, `Usuario`, `OrdemServico`), `package.json` (script `importar:plano`)
- Create: `prisma/migrations/<timestamp>_dinheiro/migration.sql` (gerada), `src/infra/importacao/plano-legado.ts`, `scripts/importar-plano.ts`
- Test: `src/infra/importacao/plano-legado.int.test.ts`

**Interfaces:**
- Consumes: `converterContaLegado` (Task 1), `lerDbf` (`src/infra/importacao/dbf.ts`), `prisma`.
- Produces: tabelas `conta_plano`, `recebimento`, `lancamento_caixa`; `empresa.conta_recebimento_id`; `ordem_servico.concluida_por_id`; `importarPlanoLegado(caminhoDbf, empresaId): Promise<ResultadoImportacaoPlano>` com `{ total, receitas, despesas, jaExistiam, contaRecebimento: string | null }`; `npm run importar:plano`.

- [x] **Step 1: Enums e modelos**

Acrescentar ao `prisma/schema.prisma` (depois de `TipoAcrescimo`):
```prisma
/// Forma obrigatoria e sem valor de fabrica (spec, secoes 4 e 7). "Avista" do legado nao existe aqui.
enum FormaPagamento {
  dinheiro
  pix
  cartao_debito
  cartao_credito
  transferencia
  cheque
  boleto

  @@map("forma_pagamento")
}

enum TipoConta {
  receita
  despesa

  @@map("tipo_conta")
}

enum TipoLancamento {
  entrada
  saida

  @@map("tipo_lancamento")
}

/// As 48 contas do legado como estao (spec, secao 4). Desativa, nunca apaga.
model ContaPlano {
  id           String    @id @default(uuid(7)) @db.Uuid
  empresaId    String    @map("empresa_id") @db.Uuid
  empresa      Empresa   @relation(fields: [empresaId], references: [id])
  codigo       Int
  nome         String    @db.VarChar(80)
  nivel        Int       @default(0)
  tipo         TipoConta
  /// NOMENIVEL do legado: CUSTO GERAL, DESPESAS, CUSTO FINANCEIRO, DESPESAS COM VEICULO, RECEITA GERAL, COMPRAS.
  grupo        String    @db.VarChar(60)
  ativa        Boolean   @default(true)
  codigoLegado Int?      @map("codigo_legado")
  criadoEm     DateTime  @default(now()) @map("criado_em") @db.Timestamptz(3)
  atualizadoEm DateTime  @updatedAt @map("atualizado_em") @db.Timestamptz(3)

  lancamentos    LancamentoCaixa[]
  recebeVendasDe Empresa?          @relation("empresa_conta_recebimento")

  @@unique([empresaId, codigo])
  @@index([empresaId, tipo])
  @@map("conta_plano")
}

/// Log de recebimento (spec, secao 4): varios por ordem, sem parcela, juros ou vencimento.
/// Nasce colado a um lancamento de entrada na mesma transacao; erro se estorna, nunca se apaga.
model Recebimento {
  id         String         @id @default(uuid(7)) @db.Uuid
  empresaId  String         @map("empresa_id") @db.Uuid
  ordemId    String         @map("ordem_id") @db.Uuid
  ordem      OrdemServico   @relation(fields: [ordemId], references: [id])
  data       DateTime       @db.Date
  valor      Decimal        @db.Decimal(12, 4)
  forma      FormaPagamento
  observacao String?        @db.VarChar(160)
  usuarioId  String         @map("usuario_id") @db.Uuid
  usuario    Usuario        @relation("recebimento_usuario", fields: [usuarioId], references: [id])

  lancamentoId String          @unique @map("lancamento_id") @db.Uuid
  lancamento   LancamentoCaixa @relation(fields: [lancamentoId], references: [id])

  estornadoEm    DateTime? @map("estornado_em") @db.Timestamptz(3)
  estornadoPorId String?   @map("estornado_por_id") @db.Uuid
  motivoEstorno  String?   @map("motivo_estorno") @db.VarChar(160)
  criadoEm       DateTime  @default(now()) @map("criado_em") @db.Timestamptz(3)

  @@index([empresaId, ordemId])
  @@index([empresaId, data])
  @@map("recebimento")
}

/// Livro-caixa (spec, secao 4): entradas vem do recebimento, saidas sao digitadas. Parcela fica na saida.
model LancamentoCaixa {
  id            String         @id @default(uuid(7)) @db.Uuid
  empresaId     String         @map("empresa_id") @db.Uuid
  data          DateTime       @db.Date
  tipo          TipoLancamento
  valor         Decimal        @db.Decimal(12, 4)
  contaId       String         @map("conta_id") @db.Uuid
  conta         ContaPlano     @relation(fields: [contaId], references: [id])
  historico     String         @db.VarChar(160)
  ordemId       String?        @map("ordem_id") @db.Uuid
  ordem         OrdemServico?  @relation(fields: [ordemId], references: [id])
  fornecedor    String?        @db.VarChar(120)
  parcela       Int?
  totalParcelas Int?           @map("total_parcelas")
  usuarioId     String         @map("usuario_id") @db.Uuid
  usuario       Usuario        @relation("lancamento_usuario", fields: [usuarioId], references: [id])
  recebimento   Recebimento?

  estornadoEm    DateTime? @map("estornado_em") @db.Timestamptz(3)
  estornadoPorId String?   @map("estornado_por_id") @db.Uuid
  motivoEstorno  String?   @map("motivo_estorno") @db.VarChar(160)
  criadoEm       DateTime  @default(now()) @map("criado_em") @db.Timestamptz(3)

  @@index([empresaId, data])
  @@index([empresaId, ordemId])
  @@index([empresaId, contaId])
  @@map("lancamento_caixa")
}
```

Em `Empresa`, acrescentar (antes de `@@map`):
```prisma
  /// A conta de receita em que todo recebimento e lancado (VENDAS DIVERSAS na importacao). Sem ela, receber recusa.
  contaRecebimentoId String?     @unique @map("conta_recebimento_id") @db.Uuid
  contaRecebimento   ContaPlano? @relation("empresa_conta_recebimento", fields: [contaRecebimentoId], references: [id])
  contas             ContaPlano[]
```
Em `Usuario`, acrescentar às relações:
```prisma
  ordensConcluidas  OrdemServico[]    @relation("ordem_concluida_por")
  recebimentos      Recebimento[]     @relation("recebimento_usuario")
  lancamentos       LancamentoCaixa[] @relation("lancamento_usuario")
```
Em `OrdemServico`, logo depois de `concluidaEm`:
```prisma
  concluidaPorId     String?   @map("concluida_por_id") @db.Uuid
  concluidaPor       Usuario?  @relation("ordem_concluida_por", fields: [concluidaPorId], references: [id])
```
e às relações no fim:
```prisma
  recebimentos Recebimento[]
  lancamentos  LancamentoCaixa[]
```

- [x] **Step 2: Migração**

Run: `npm run db:migrar -- dinheiro`
Expected: `prisma/migrations/<timestamp>_dinheiro/migration.sql` com `CREATE TYPE "forma_pagamento"`, `"tipo_conta"`, `"tipo_lancamento"`, `CREATE TABLE "conta_plano"`, `"recebimento"`, `"lancamento_caixa"`, `ALTER TABLE "empresa" ADD COLUMN "conta_recebimento_id"`, `ALTER TABLE "ordem_servico" ADD COLUMN "concluida_por_id"`, índice único `recebimento_lancamento_id_key`; `migrate deploy` aplicado no `drusign`; `prisma generate` rodado. Conferir o SQL com o Read tool antes de seguir. Run: `npm run typecheck` → sem erros.

- [x] **Step 3: Importação do plano (teste de integração)**

`src/infra/importacao/plano-legado.int.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { prisma } from '@/infra/db/prisma'
import { importarPlanoLegado } from './plano-legado'

const DBF = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CONTAS.DBF'

// O harness trunca antes de cada `it`: tudo num teste so.
describe.skipIf(!existsSync(DBF))('importacao do plano de contas do legado', () => {
  it('importa as 48 contas como estao, aponta a empresa para VENDAS DIVERSAS e nao repete', async () => {
    const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
    const r = await importarPlanoLegado(DBF, empresa.id)
    expect(r).toMatchObject({ total: 48, receitas: 3, despesas: 45, jaExistiam: 0, contaRecebimento: 'VENDAS DIVERSAS' })

    const contas = await prisma.contaPlano.findMany({ where: { empresaId: empresa.id }, orderBy: { codigo: 'asc' } })
    expect(contas).toHaveLength(48)
    expect(contas[0]).toMatchObject({ codigo: 1, codigoLegado: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL', ativa: true })
    expect(contas[5]).toMatchObject({ codigo: 6, nome: 'MANUTENÇÃO DO VEÍCULO', grupo: 'DESPESAS COM VEICULO' }) // CP1252 decodificado
    expect(contas[23]?.nome).toBe('ODETE   - PESSOAL') // como esta, inclusive os espacos
    expect(new Set(contas.map((c) => c.grupo)).size).toBe(6)

    const e = await prisma.empresa.findUniqueOrThrow({ where: { id: empresa.id }, include: { contaRecebimento: true } })
    expect(e.contaRecebimento?.nome).toBe('VENDAS DIVERSAS')

    const de_novo = await importarPlanoLegado(DBF, empresa.id)
    expect(de_novo).toMatchObject({ total: 0, jaExistiam: 48 })
    expect(await prisma.contaPlano.count({ where: { empresaId: empresa.id } })).toBe(48)
  })
})
```

Run: `npm run test:int -- plano-legado` → vermelho (`Cannot find module './plano-legado'`).

- [x] **Step 4: Importação (implementação) e script**

`src/infra/importacao/plano-legado.ts`:
```ts
import { lerDbf } from './dbf'
import { prisma } from '@/infra/db/prisma'
import { converterContaLegado } from '@/domain/caixa/plano'

export interface ResultadoImportacaoPlano {
  total: number
  receitas: number
  despesas: number
  jaExistiam: number
  /** Nome da conta que passou a receber as vendas; null se o codigo 1 nao for uma receita. */
  contaRecebimento: string | null
}

/** Codigo 1 do legado = VENDAS DIVERSAS: 14.692 dos 14.692 titulos com conta apontam para ela. */
const CODIGO_VENDAS = 1

/** Idempotente por cobertura: se a empresa ja tem conta com codigo legado, nao importa de novo. */
export async function importarPlanoLegado(caminhoDbf: string, empresaId: string): Promise<ResultadoImportacaoPlano> {
  const jaExistiam = await prisma.contaPlano.count({ where: { empresaId, codigoLegado: { not: null } } })
  if (jaExistiam > 0) return { total: 0, receitas: 0, despesas: 0, jaExistiam, contaRecebimento: null }

  const contas = lerDbf(caminhoDbf).registros.filter((r) => !r.apagado).map((r) => converterContaLegado(r.valores))
  const vendas = contas.find((c) => c.codigo === CODIGO_VENDAS && c.tipo === 'receita')

  await prisma.$transaction(async (tx) => {
    await tx.contaPlano.createMany({
      data: contas.map((c) => ({ empresaId, codigo: c.codigo, codigoLegado: c.codigo, nome: c.nome, nivel: c.nivel, tipo: c.tipo, grupo: c.grupo })),
    })
    if (vendas) {
      const conta = await tx.contaPlano.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo: vendas.codigo } }, select: { id: true } })
      await tx.empresa.update({ where: { id: empresaId }, data: { contaRecebimentoId: conta.id } })
    }
  })

  return {
    total: contas.length,
    receitas: contas.filter((c) => c.tipo === 'receita').length,
    despesas: contas.filter((c) => c.tipo === 'despesa').length,
    jaExistiam: 0,
    contaRecebimento: vendas?.nome ?? null,
  }
}
```

`scripts/importar-plano.ts`:
```ts
// Uso: npm run importar:plano [caminho-do-CONTAS.DBF]
import '../src/infra/carrega-env'
import { prisma } from '../src/infra/db/prisma'
import { importarPlanoLegado } from '../src/infra/importacao/plano-legado'

const PADRAO = 'C:/legacy-drusign-dados/OSGRAFICA4.5A/DADOS/CONTAS.DBF'

async function main(): Promise<void> {
  const caminho = process.argv[2] ?? PADRAO
  const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } })
  const r = await importarPlanoLegado(caminho, empresa.id)
  if (r.jaExistiam > 0) {
    console.log(`nada a fazer: a empresa "${empresa.razaoSocial}" ja tem ${r.jaExistiam} contas importadas`)
    return
  }
  console.log(`${r.total} contas importadas para "${empresa.razaoSocial}" (${r.receitas} receitas, ${r.despesas} despesas); recebimentos vao para "${r.contaRecebimento ?? 'NENHUMA — defina no plano de contas'}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

Em `package.json`, ao lado de `importar:clientes`, acrescentar `"importar:plano": "tsx scripts/importar-plano.ts"` (mesmo runner do `importar:clientes`; conferir o comando existente e copiar o prefixo).

Run: `npm run test:int -- plano-legado` → PASS (1). Run: `npm run importar:plano` no banco de desenvolvimento → `48 contas importadas para "DruSign Placas e Comunicacao Visual" (3 receitas, 45 despesas); recebimentos vao para "VENDAS DIVERSAS"`.

- [x] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations package.json src/infra/importacao/plano-legado.ts src/infra/importacao/plano-legado.int.test.ts scripts/importar-plano.ts
git commit -m "feat: modelos de conta do plano, recebimento e lancamento de caixa; importacao das 48 contas do legado"
```

**Executado (29/08/2026).** Migracao `20260829170940_dinheiro` gerada e aplicada; o SQL traz
os tres `CREATE TYPE`, as tres tabelas, os dois `ADD COLUMN` e o `recebimento_lancamento_id_key`,
como previsto. `npm run test:int -- plano-legado` = 1 passed; `npm run importar:plano` no banco de
desenvolvimento imprimiu exatamente `48 contas importadas para "DruSign Placas e Comunicacao Visual"
(3 receitas, 45 despesas); recebimentos vao para "VENDAS DIVERSAS"`. Sem desvios.

---

### Task 3: Repositório do dinheiro — a transação única, estorno, livro-caixa, plano, fila e o eixo de pagamento na tela

**Files:**
- Create: `src/infra/ordens/erros.ts`, `src/infra/caixa/resumo.ts`, `src/infra/caixa/recebimentos.ts`, `src/infra/caixa/livro.ts`, `src/infra/caixa/plano.ts`, `src/infra/caixa/fila.ts`
- Modify: `src/infra/ordens/repositorio.ts` (erros movem para `erros.ts` e são re-exportados), `src/infra/ordens/tela.ts` (`OrdemTela.pagamento/recebimentos/concluidaEm`; `listarOrdens` com filtros e eixo de pagamento), `src/domain/ordem/datas.ts` (`hojeCalendario`, `mesCalendario`, `limitesDoDia`)
- Test: `src/domain/ordem/datas.test.ts` (acrescenta), `src/infra/caixa/dinheiro.int.test.ts`

**Interfaces:**
- Consumes: `executarUmaVez`, `Contexto`, `Tx`; `paraBanco`/`paraDominio`; `resumirPagamento`, `validarRecebimento`, `validarSaida`, `historicoDeRecebimento`, `classificarFila`, `OrdemDaFila`; `transicionar`; `ErroDeValidacao`.
- Produces:
  - `ConflitoVersao`, `OrdemNaoEditavel` em `src/infra/ordens/erros.ts` (ainda exportados por `repositorio.ts`)
  - `totalRecebidoPorOrdem(db, empresaId, ordemIds): Promise<Map<string, string>>`
  - `DadosRecebimento = { valor: string; forma: string; data: string; observacao?: string; concluir: boolean }`, `ResultadoDinheiro = { versao; estadoProducao; estadoPagamento; totalRecebido: string; saldo: string }`
  - `registrarRecebimento(ctx, ordemId, versao, dados)`, `concluirOrdem(ctx, ordemId, versao)`, `estornarRecebimento(ctx, ordemId, versao, recebimentoId, motivo)` → `Promise<ResultadoDinheiro>`
  - `DadosSaida = { valor; data; historico; contaId; fornecedor: string; parcela: string; totalParcelas: string }`, `registrarSaida(ctx, dados): Promise<{ id: string }>`, `estornarLancamento(ctx, lancamentoId, motivo): Promise<{ id: string }>`, `LinhaLivro`, `Livro`, `listarLivro(empresaId, { de, ate }): Promise<Livro>`
  - `ContaTela`, `listarContas(empresaId, { incluirInativas? })`, `criarConta(empresaId, { nome, tipo, grupo }): Promise<{ id }>`, `alterarAtiva(empresaId, contaId, ativa)`, `definirContaRecebimento(empresaId, contaId)`
  - `carregarFila(empresaId, agora?): Promise<Fila>`
  - `OrdemTela` ganha `concluidaEm: string | null`, `pagamento: { estado: EstadoPagamento; totalRecebido: string; saldo: string }`, `recebimentos: RecebimentoTela[]` (`{ id; data; valor; forma; observacao; usuario; estornadoEm; motivoEstorno }`); `OrdemResumo` ganha `estadoPagamento`, `saldo`; `listarOrdens(empresaId, filtros: FiltrosOrdens = { q?, estado?, de?, ate?, limite? })`
  - `hojeCalendario(agora: Date): string` ('AAAA-MM-DD' em America/Sao_Paulo), `mesCalendario(agora: Date): { de: string; ate: string }`, `limitesDoDia(de: string, ate: string): { inicio: Date; fim: Date } | null`
  - `permissoes(estado).concluir/receber` (Task 1) passam a ser usadas pelas telas

- [x] **Step 1: Datas do calendário em São Paulo (teste e implementação)**

Acrescentar a `src/domain/ordem/datas.test.ts`:
```ts
import { hojeCalendario, mesCalendario, limitesDoDia } from './datas'

describe('calendario em Sao Paulo', () => {
  it('hojeCalendario vira o dia em Sao Paulo, nao em UTC', () => {
    expect(hojeCalendario(new Date('2026-08-29T02:30:00.000Z'))).toBe('2026-08-28') // 23:30 do dia 28 em SP
    expect(hojeCalendario(new Date('2026-08-29T03:00:00.000Z'))).toBe('2026-08-29')
  })
  it('mesCalendario da o primeiro e o ultimo dia do mes', () => {
    expect(mesCalendario(new Date('2026-08-29T15:00:00.000Z'))).toEqual({ de: '2026-08-01', ate: '2026-08-31' })
    expect(mesCalendario(new Date('2026-02-10T15:00:00.000Z'))).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(mesCalendario(new Date('2026-01-01T01:00:00.000Z'))).toEqual({ de: '2025-12-01', ate: '2025-12-31' }) // ainda 31/12 em SP
  })
  it('limitesDoDia cobre do 00:00 de "de" ao 00:00 do dia seguinte a "ate", em Sao Paulo (UTC-3)', () => {
    expect(limitesDoDia('2026-08-01', '2026-08-31')).toEqual({ inicio: new Date('2026-08-01T03:00:00.000Z'), fim: new Date('2026-09-01T03:00:00.000Z') })
    expect(limitesDoDia('2026-08-31', '2026-08-01')).toBeNull()
    expect(limitesDoDia('x', '2026-08-01')).toBeNull()
  })
})
```

Acrescentar a `src/domain/ordem/datas.ts`:
```ts
const FUSO = 'America/Sao_Paulo'

/** 'AAAA-MM-DD' do dia em Sao Paulo. O Brasil nao tem horario de verao desde 2019: e sempre UTC-3. */
export function hojeCalendario(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')}`
}

/** Primeiro e ultimo dia do mes de `agora`, em Sao Paulo. */
export function mesCalendario(agora: Date): { de: string; ate: string } {
  const hoje = hojeCalendario(agora)
  const [ano, mes] = hoje.split('-').map(Number) as [number, number]
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const mm = String(mes).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Intervalo [inicio, fim) em instantes, para filtrar timestamptz por dia do calendario de Sao Paulo. */
export function limitesDoDia(de: string, ate: string): { inicio: Date; fim: Date } | null {
  const d = lerDataCalendario(de)
  const a = lerDataCalendario(ate)
  if (!d || !a || d.getTime() > a.getTime()) return null
  const inicio = new Date(d.getTime() + 3 * 3_600_000)
  const fim = new Date(a.getTime() + 27 * 3_600_000)
  return { inicio, fim }
}
```
(`lerDataCalendario` devolve `Date` à meia-noite UTC; somar 3h dá a meia-noite de São Paulo. Se `datas.test.ts` ainda não importa `describe`/`it`/`expect` no topo, já importa — só acrescentar o bloco.)

Run: `npm test -- src/domain/ordem/datas` → PASS.

- [x] **Step 2: Erros da ordem em arquivo próprio e o resumo por ordem**

`src/infra/ordens/erros.ts`:
```ts
export class ConflitoVersao extends Error {
  constructor() {
    super('a ordem mudou desde a ultima leitura')
  }
}
export class OrdemNaoEditavel extends Error {
  constructor(estado: string) {
    super(`ordem ${estado}: nao aceita esta alteracao`)
  }
}
```
Em `src/infra/ordens/repositorio.ts`, apagar as duas classes e no lugar:
```ts
import { ConflitoVersao, OrdemNaoEditavel } from './erros'
export { ConflitoVersao, OrdemNaoEditavel }
```
(`recebimentos.ts` importa de `./erros` para não fechar o ciclo `repositorio → tela → resumo`.)

`src/infra/caixa/resumo.ts`:
```ts
import { paraDominio } from '@/infra/db/decimal'
import type { prisma } from '@/infra/db/prisma'
import type { Tx } from '@/infra/mutacoes/idempotencia'

export type Db = Tx | typeof prisma

/** Soma dos recebimentos vivos (nao estornados) por ordem, como string decimal. Ordem sem recebimento nao aparece no Map. */
export async function totalRecebidoPorOrdem(db: Db, empresaId: string, ordemIds: string[]): Promise<Map<string, string>> {
  if (ordemIds.length === 0) return new Map()
  const grupos = await db.recebimento.groupBy({
    by: ['ordemId'],
    where: { empresaId, ordemId: { in: ordemIds }, estornadoEm: null },
    _sum: { valor: true },
  })
  return new Map(grupos.map((g) => [g.ordemId, g._sum.valor ? paraDominio(g._sum.valor).toFixed(2) : '0.00']))
}
```

Run: `npm run typecheck` → sem erros.

- [x] **Step 3: Recebimento, conclusão e estorno (teste de integração)**

`src/infra/caixa/dinheiro.int.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/infra/db/prisma'
import type { Contexto } from '@/infra/mutacoes/idempotencia'
import { criarOrdem, adicionarItem, obterOrdemParaTela, listarOrdens, ConflitoVersao, OrdemNaoEditavel, type DadosItem } from '@/infra/ordens/repositorio'
import { registrarRecebimento, concluirOrdem, estornarRecebimento } from './recebimentos'
import { registrarSaida, estornarLancamento, listarLivro } from './livro'
import { listarContas, criarConta, alterarAtiva, definirContaRecebimento } from './plano'
import { carregarFila } from './fila'

let base: Contexto
let contaVendas = ''
let contaAgua = ''
const ctx = () => ({ ...base, chave: randomUUID() })
const ITEM = (descricao: string, valorUnitario: string): DadosItem =>
  ({ descricao, materialId: null, quantidade: 1, altura: null, largura: null, unidadeCobranca: 'unidade', valorUnitario })

beforeEach(async () => {
  const empresa = await prisma.empresa.create({ data: { razaoSocial: 'Grafica de Teste' } })
  const usuario = await prisma.usuario.create({ data: { empresaId: empresa.id, nome: 'Odete Silva', login: 'odete', senhaHash: 'x', papel: 'administracao' } })
  await prisma.contadorEmpresa.create({ data: { empresaId: empresa.id, proximaOs: 18461 } })
  const vendas = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 1, nome: 'VENDAS DIVERSAS', nivel: 1, tipo: 'receita', grupo: 'RECEITA GERAL' } })
  const agua = await prisma.contaPlano.create({ data: { empresaId: empresa.id, codigo: 3, nome: 'AGUA', nivel: 2, tipo: 'despesa', grupo: 'CUSTO GERAL' } })
  await prisma.empresa.update({ where: { id: empresa.id }, data: { contaRecebimentoId: vendas.id } })
  contaVendas = vendas.id
  contaAgua = agua.id
  base = { empresaId: empresa.id, usuarioId: usuario.id, chave: randomUUID() }
})

async function ordemComItem(valor: string, estado: 'aberta' | 'orcamento' = 'aberta') {
  const ordem = await criarOrdem(ctx(), { estado })
  const t = await adicionarItem(ctx(), ordem.id, ordem.versao, ITEM('placa', valor))
  return { id: ordem.id, numero: ordem.numero, versao: t.versao }
}

describe('concluir e receber (banco real)', () => {
  it('grava os tres registros numa transacao: ordem concluida, recebimento e lancamento de entrada', async () => {
    const o = await ordemComItem('150.00')
    const r = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '150,00', forma: 'pix', data: '2026-08-29', concluir: true })
    expect(r).toEqual({ versao: o.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'pago', totalRecebido: '150.00', saldo: '0.00' })

    const ordem = await prisma.ordemServico.findUniqueOrThrow({ where: { id: o.id }, include: { recebimentos: { include: { lancamento: true } } } })
    expect(ordem.estadoProducao).toBe('concluida')
    expect(ordem.concluidaEm).not.toBeNull()
    expect(ordem.concluidaPorId).toBe(base.usuarioId)
    expect(ordem.recebimentos).toHaveLength(1)
    const rec = ordem.recebimentos[0]!
    expect(rec).toMatchObject({ forma: 'pix', usuarioId: base.usuarioId, estornadoEm: null })
    expect(rec.valor.toFixed(2)).toBe('150.00')
    expect(rec.data.toISOString()).toBe('2026-08-29T00:00:00.000Z')
    expect(rec.lancamento).toMatchObject({ tipo: 'entrada', contaId: contaVendas, ordemId: o.id, historico: `OS 0${o.numero} · Venda de balcão · Pix` })
    expect(rec.lancamento.valor.toFixed(2)).toBe('150.00')

    const tela = await obterOrdemParaTela(base.empresaId, o.id)
    expect(tela?.pagamento).toEqual({ estado: 'pago', totalRecebido: '150.00', saldo: '0.00' })
    expect(tela?.recebimentos.map((x) => [x.forma, x.valor, x.usuario])).toEqual([['pix', '150.00', 'Odete Silva']])
    expect(tela?.concluidaEm).not.toBeNull()
  })

  it('ou nada: dois recebimentos com a mesma versao — um grava os tres registros, o outro desfaz tudo', async () => {
    const o = await ordemComItem('150.00')
    const dados = { valor: '150,00', forma: 'dinheiro', data: '2026-08-29', concluir: true }
    const resultados = await Promise.allSettled([
      registrarRecebimento(ctx(), o.id, o.versao, dados),
      registrarRecebimento(ctx(), o.id, o.versao, dados),
    ])
    const ok = resultados.filter((r) => r.status === 'fulfilled')
    const falhou = resultados.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(falhou).toHaveLength(1)
    expect((falhou[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflitoVersao)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1)
    expect(await prisma.lancamentoCaixa.count({ where: { ordemId: o.id } })).toBe(1)
    expect(await prisma.mutacao.count({ where: { empresaId: base.empresaId, acao: 'recebimento.registrar' } })).toBe(1) // a chave do perdedor foi desfeita junto
  })

  it('sem conta de recebimento na empresa, nada e gravado e a mensagem explica', async () => {
    await prisma.empresa.update({ where: { id: base.empresaId }, data: { contaRecebimentoId: null } })
    const o = await ordemComItem('150.00')
    await expect(registrarRecebimento(ctx(), o.id, o.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })).rejects.toThrow(/conta que recebe as vendas/)
    const ordem = await prisma.ordemServico.findUniqueOrThrow({ where: { id: o.id } })
    expect(ordem.estadoProducao).toBe('aberta')
    expect(ordem.versao).toBe(o.versao)
    expect(await prisma.recebimento.count()).toBe(0)
    expect(await prisma.lancamentoCaixa.count()).toBe(0)
  })

  it('parcial: 80 de 200 fica parcial, 120 completa; acima do saldo e recusado', async () => {
    const o = await ordemComItem('200.00')
    const r1 = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '80', forma: 'dinheiro', data: '2026-08-29', concluir: false })
    expect(r1).toMatchObject({ estadoProducao: 'aberta', estadoPagamento: 'parcial', totalRecebido: '80.00', saldo: '120.00' })
    await expect(registrarRecebimento(ctx(), o.id, r1.versao, { valor: '120,02', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(/saldo a receber \(R\$ 120,00\)/)
    const r2 = await registrarRecebimento(ctx(), o.id, r1.versao, { valor: '120', forma: 'pix', data: '2026-08-30', concluir: true })
    expect(r2).toMatchObject({ estadoProducao: 'concluida', estadoPagamento: 'pago', totalRecebido: '200.00', saldo: '0.00' })
    await expect(registrarRecebimento(ctx(), o.id, r2.versao, { valor: '1', forma: 'pix', data: '2026-08-30', concluir: false })).rejects.toThrow(/já está paga/)
  })

  it('idempotente: a mesma chave duas vezes grava um recebimento e devolve a mesma resposta', async () => {
    const o = await ordemComItem('150.00')
    const c = ctx()
    const dados = { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true }
    const a = await registrarRecebimento(c, o.id, o.versao, dados)
    const b = await registrarRecebimento(c, o.id, o.versao, dados)
    expect(b).toEqual(a)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1)
  })

  it('trava otimista, orcamento e cancelada', async () => {
    const o = await ordemComItem('150.00')
    await expect(registrarRecebimento(ctx(), o.id, o.versao - 1, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(ConflitoVersao)
    const orc = await ordemComItem('90.00', 'orcamento')
    await expect(registrarRecebimento(ctx(), orc.id, orc.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow(/aprove o orçamento/)
    await expect(registrarRecebimento(ctx(), orc.id, orc.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: true })).rejects.toThrow(OrdemNaoEditavel)
  })

  it('servico finalizado nao toca em dinheiro; concluir duas vezes e recusado', async () => {
    const o = await ordemComItem('150.00')
    const r = await concluirOrdem(ctx(), o.id, o.versao)
    expect(r).toEqual({ versao: o.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'nao_pago', totalRecebido: '0.00', saldo: '150.00' })
    expect(await prisma.lancamentoCaixa.count()).toBe(0)
    await expect(concluirOrdem(ctx(), o.id, r.versao)).rejects.toThrow(OrdemNaoEditavel)
    const r2 = await registrarRecebimento(ctx(), o.id, r.versao, { valor: '150', forma: 'cheque', data: '2026-08-29', concluir: false })
    expect(r2.estadoPagamento).toBe('pago')
  })

  it('estorno marca recebimento e lancamento, exige motivo, e o eixo volta a nao pago', async () => {
    const o = await ordemComItem('150.00')
    const r = await registrarRecebimento(ctx(), o.id, o.versao, { valor: '150', forma: 'pix', data: '2026-08-29', concluir: true })
    const rec = await prisma.recebimento.findFirstOrThrow({ where: { ordemId: o.id } })
    await expect(estornarRecebimento(ctx(), o.id, r.versao, rec.id, '  ')).rejects.toThrow(/motivo/)
    const e = await estornarRecebimento(ctx(), o.id, r.versao, rec.id, 'valor digitado errado')
    expect(e).toMatchObject({ versao: r.versao + 1, estadoProducao: 'concluida', estadoPagamento: 'nao_pago', totalRecebido: '0.00', saldo: '150.00' })
    const depois = await prisma.recebimento.findUniqueOrThrow({ where: { id: rec.id }, include: { lancamento: true } })
    expect(depois).toMatchObject({ motivoEstorno: 'valor digitado errado', estornadoPorId: base.usuarioId })
    expect(depois.estornadoEm).not.toBeNull()
    expect(depois.lancamento.estornadoEm).not.toBeNull()
    expect(depois.lancamento.motivoEstorno).toBe('valor digitado errado')
    await expect(estornarRecebimento(ctx(), o.id, e.versao, rec.id, 'de novo')).rejects.toThrow(/já estornado/)
    expect(await prisma.recebimento.count({ where: { ordemId: o.id } })).toBe(1) // nada apagado
  })

  it('a ordem de outra empresa nao e vista', async () => {
    const o = await ordemComItem('150.00')
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    await expect(registrarRecebimento({ ...ctx(), empresaId: outra.id }, o.id, o.versao, { valor: '10', forma: 'pix', data: '2026-08-29', concluir: false })).rejects.toThrow('ordem nao encontrada')
  })
})

describe('livro-caixa e plano (banco real)', () => {
  it('saida com parcela, entradas dos recebimentos, totais do periodo e estorno riscado', async () => {
    const o = await ordemComItem('300.00')
    await registrarRecebimento(ctx(), o.id, o.versao, { valor: '300', forma: 'pix', data: '2026-08-10', concluir: true })
    const s = await registrarSaida(ctx(), { valor: '45,90', data: '2026-08-12', historico: 'Conta de agua', contaId: contaAgua, fornecedor: 'COPASA', parcela: '2', totalParcelas: '3' })
    await registrarSaida(ctx(), { valor: '10', data: '2026-09-01', historico: 'Fora do periodo', contaId: contaAgua, fornecedor: '', parcela: '', totalParcelas: '' })

    const livro = await listarLivro(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })
    expect(livro.linhas.map((l) => [l.tipo, l.valor, l.historico, l.contaNome, l.ordemNumero, l.fornecedor, l.parcela, l.totalParcelas, l.usuarioNome])).toEqual([
      ['entrada', '300.00', `OS 0${o.numero} · Venda de balcão · Pix`, 'VENDAS DIVERSAS', o.numero, null, null, null, 'Odete Silva'],
      ['saida', '45.90', 'Conta de agua', 'AGUA', null, 'COPASA', 2, 3, 'Odete Silva'],
    ])
    expect(livro).toMatchObject({ entradas: '300.00', saidas: '45.90', saldo: '254.10' })

    await expect(estornarLancamento(ctx(), s.id, '')).rejects.toThrow(/motivo/)
    await estornarLancamento(ctx(), s.id, 'lancado em duplicidade')
    const depois = await listarLivro(base.empresaId, { de: '2026-08-01', ate: '2026-08-31' })
    expect(depois.linhas[1]).toMatchObject({ estornadoEm: expect.any(String), motivoEstorno: 'lancado em duplicidade' })
    expect(depois).toMatchObject({ entradas: '300.00', saidas: '0.00', saldo: '300.00' })

    const entrada = depois.linhas[0]!
    await expect(estornarLancamento(ctx(), entrada.id, 'x')).rejects.toThrow(/pelo recebimento/)
  })

  it('saida recusa conta de receita, conta de outra empresa e periodo invertido', async () => {
    await expect(registrarSaida(ctx(), { valor: '10', data: '2026-08-12', historico: 'x', contaId: contaVendas, fornecedor: '', parcela: '', totalParcelas: '' })).rejects.toThrow(/conta de despesa/)
    const outra = await prisma.empresa.create({ data: { razaoSocial: 'Outra' } })
    const alheia = await prisma.contaPlano.create({ data: { empresaId: outra.id, codigo: 1, nome: 'LUZ', tipo: 'despesa', grupo: 'G' } })
    await expect(registrarSaida(ctx(), { valor: '10', data: '2026-08-12', historico: 'x', contaId: alheia.id, fornecedor: '', parcela: '', totalParcelas: '' })).rejects.toThrow(/conta não encontrada/)
    await expect(listarLivro(base.empresaId, { de: '2026-08-31', ate: '2026-08-01' })).rejects.toThrow(/período/)
  })

  it('plano: lista por grupo, cria com o proximo codigo, recusa nome repetido, desativa e troca a conta de vendas', async () => {
    const antes = await listarContas(base.empresaId)
    expect(antes.map((c) => [c.grupo, c.codigo, c.recebeVendas])).toEqual([['CUSTO GERAL', 3, false], ['RECEITA GERAL', 1, true]])
    const nova = await criarConta(base.empresaId, { nome: '  Marketing digital ', tipo: 'despesa', grupo: 'DESPESAS' })
    expect(await prisma.contaPlano.findUniqueOrThrow({ where: { id: nova.id } })).toMatchObject({ codigo: 4, nome: 'Marketing digital', tipo: 'despesa', grupo: 'DESPESAS', ativa: true })
    await expect(criarConta(base.empresaId, { nome: 'marketing DIGITAL', tipo: 'despesa', grupo: 'DESPESAS' })).rejects.toThrow(/já existe/)
    await expect(criarConta(base.empresaId, { nome: 'X', tipo: 'lucro', grupo: 'DESPESAS' })).rejects.toThrow(/tipo/)
    await expect(criarConta(base.empresaId, { nome: '', tipo: 'despesa', grupo: 'DESPESAS' })).rejects.toThrow(/nome/)

    await alterarAtiva(base.empresaId, nova.id, false)
    expect((await listarContas(base.empresaId)).map((c) => c.codigo)).toEqual([3, 1])
    expect((await listarContas(base.empresaId, { incluirInativas: true })).map((c) => c.codigo)).toEqual([3, 4, 1])
    await expect(alterarAtiva(base.empresaId, contaVendas, false)).rejects.toThrow(/recebe as vendas/)

    await expect(definirContaRecebimento(base.empresaId, contaAgua)).rejects.toThrow(/receita/)
    const deposito = await criarConta(base.empresaId, { nome: 'DEPOSITO', tipo: 'receita', grupo: 'RECEITA GERAL' })
    await definirContaRecebimento(base.empresaId, deposito.id)
    expect((await listarContas(base.empresaId)).find((c) => c.recebeVendas)?.nome).toBe('DEPOSITO')
  })
})

describe('fila e lista (banco real)', () => {
  it('fila: aberta ha 8 dias e parada; concluida nao paga esta a cobrar com o saldo; paga e recente ficam fora', async () => {
    const velha = await ordemComItem('100.00')
    await prisma.ordemServico.update({ where: { id: velha.id }, data: { abertaEm: new Date(Date.now() - 8 * 86_400_000) } })
    const recente = await ordemComItem('100.00')
    const cobrar = await ordemComItem('300.00')
    const c1 = await concluirOrdem(ctx(), cobrar.id, cobrar.versao)
    await registrarRecebimento(ctx(), cobrar.id, c1.versao, { valor: '100', forma: 'pix', data: '2026-08-29', concluir: false })
    const paga = await ordemComItem('50.00')
    await registrarRecebimento(ctx(), paga.id, paga.versao, { valor: '50', forma: 'pix', data: '2026-08-29', concluir: true })

    const fila = await carregarFila(base.empresaId)
    expect(fila.paradas.map((o) => o.id)).toEqual([velha.id])
    expect(fila.aCobrar.map((o) => [o.id, o.saldo])).toEqual([[cobrar.id, '200.00']])
    expect(fila.totalACobrar).toBe('200.00')
    expect(fila.paradas.find((o) => o.id === recente.id)).toBeUndefined()
  })

  it('listarOrdens mostra os dois eixos e filtra por numero, nome, estado e periodo', async () => {
    const a = await ordemComItem('100.00')
    const b = await ordemComItem('200.00')
    await registrarRecebimento(ctx(), b.id, b.versao, { valor: '50', forma: 'pix', data: '2026-08-29', concluir: true })
    await prisma.ordemServico.update({ where: { id: a.id }, data: { clienteNome: 'Prefeitura de Unaí', clienteApelido: 'PMU', abertaEm: new Date('2026-07-15T15:00:00.000Z') } })

    const todas = await listarOrdens(base.empresaId)
    expect(todas.map((o) => [o.id, o.estadoProducao, o.estadoPagamento, o.saldo])).toEqual([[b.id, 'concluida', 'parcial', '150.00'], [a.id, 'aberta', 'nao_pago', '100.00']])
    expect((await listarOrdens(base.empresaId, { q: String(a.numero) })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { q: 'pmu' })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { q: 'unaí' })).map((o) => o.id)).toEqual([a.id])
    expect((await listarOrdens(base.empresaId, { estado: 'concluida' })).map((o) => o.id)).toEqual([b.id])
    expect((await listarOrdens(base.empresaId, { de: '2026-07-01', ate: '2026-07-31' })).map((o) => o.id)).toEqual([a.id])
    expect(await listarOrdens(base.empresaId, { de: '2026-07-31', ate: '2026-07-01' })).toEqual([])
  })
})
```

Run: `npm run test:int -- dinheiro` → vermelho (`Cannot find module './recebimentos'`).

- [x] **Step 4: Recebimentos — a transação única**

`src/infra/caixa/recebimentos.ts`:
```ts
import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { executarUmaVez, type Contexto, type Tx } from '@/infra/mutacoes/idempotencia'
import { ConflitoVersao, OrdemNaoEditavel } from '@/infra/ordens/erros'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { transicionar, type EstadoPagamento, type EstadoProducao } from '@/domain/ordem/estados'
import { resumirPagamento, validarRecebimento, type ResumoPagamento } from '@/domain/caixa/pagamento'
import { historicoDeRecebimento } from '@/domain/caixa/lancamento'
import { totalRecebidoPorOrdem } from './resumo'
import type { Prisma } from '@/generated/prisma/client'

export interface DadosRecebimento {
  /** Como digitado: "150", "150,00". */
  valor: string
  forma: string
  /** 'AAAA-MM-DD'. */
  data: string
  observacao?: string
  /** "Concluir e receber": a transicao aberta -> concluida entra na mesma transacao. */
  concluir: boolean
}

/** JSON puro: e o que a action devolve e o que a tabela mutacao guarda. */
export interface ResultadoDinheiro {
  versao: number
  estadoProducao: EstadoProducao
  estadoPagamento: EstadoPagamento
  totalRecebido: string
  saldo: string
}

async function carregarComTrava(tx: Tx, ctx: Contexto, ordemId: string, versao: number) {
  const ordem = await tx.ordemServico.findFirst({
    where: { id: ordemId, empresaId: ctx.empresaId },
    select: { id: true, numero: true, estadoProducao: true, versao: true, precoFinal: true, clienteNome: true, clienteApelido: true },
  })
  if (!ordem) throw new Error('ordem nao encontrada')
  if (ordem.versao !== versao) throw new ConflitoVersao()
  return ordem
}

async function resumo(tx: Tx, empresaId: string, ordemId: string, precoFinal: Prisma.Decimal): Promise<ResumoPagamento> {
  const total = (await totalRecebidoPorOrdem(tx, empresaId, [ordemId])).get(ordemId) ?? '0.00'
  return resumirPagamento(paraDominio(precoFinal).toFixed(), [total])
}

/** A trava: updateMany pela versao lida; 0 linhas = alguem gravou antes -> rollback de tudo que veio antes. */
async function gravarVersao(tx: Tx, ctx: Contexto, ordemId: string, versao: number, dados: Prisma.OrdemServicoUpdateManyMutationInput = {}) {
  const { count } = await tx.ordemServico.updateMany({
    where: { id: ordemId, empresaId: ctx.empresaId, versao },
    data: { ...dados, versao: { increment: 1 } },
  })
  if (count === 0) throw new ConflitoVersao()
}

function resultado(versao: number, estadoProducao: EstadoProducao, r: ResumoPagamento): ResultadoDinheiro {
  return { versao: versao + 1, estadoProducao, estadoPagamento: r.estado, totalRecebido: r.totalRecebido.toFixed(2), saldo: r.saldo.toFixed(2) }
}

const CONCLUIDA = (ctx: Contexto) => ({ estadoProducao: 'concluida' as const, concluidaEm: new Date(), concluidaPorId: ctx.usuarioId })

/**
 * Registrar o recebimento e lancar no caixa nunca sao operacoes separadas (spec, secao 6); com
 * `concluir`, a transicao aberta -> concluida entra na mesma transacao (spec, secao 9). Ou tudo, ou nada.
 */
export async function registrarRecebimento(ctx: Contexto, ordemId: string, versao: number, dados: DadosRecebimento): Promise<ResultadoDinheiro> {
  return executarUmaVez(ctx, 'recebimento.registrar', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    let estado = ordem.estadoProducao
    if (dados.concluir) {
      if (estado !== 'aberta') throw new OrdemNaoEditavel(estado)
      estado = transicionar(estado, 'concluida')
    }
    const antes = await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal)
    const r = validarRecebimento(
      { valor: dados.valor, forma: dados.forma, data: dados.data },
      { precoFinal: paraDominio(ordem.precoFinal).toFixed(), totalRecebido: antes.totalRecebido.toFixed(), estadoProducao: estado },
    )
    const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: ctx.empresaId }, select: { contaRecebimentoId: true } })
    if (!empresa.contaRecebimentoId) throw new ErroDeValidacao('defina no plano de contas a conta que recebe as vendas')

    const lancamento = await tx.lancamentoCaixa.create({
      data: {
        empresaId: ctx.empresaId, data: r.data, tipo: 'entrada', valor: paraBanco(r.valor), contaId: empresa.contaRecebimentoId,
        historico: historicoDeRecebimento(ordem.numero, ordem.clienteNome, ordem.clienteApelido, r.forma),
        ordemId: ordem.id, usuarioId: ctx.usuarioId,
      },
      select: { id: true },
    })
    await tx.recebimento.create({
      data: {
        empresaId: ctx.empresaId, ordemId: ordem.id, data: r.data, valor: paraBanco(r.valor), forma: r.forma,
        observacao: dados.observacao?.trim().slice(0, 160) || null, usuarioId: ctx.usuarioId, lancamentoId: lancamento.id,
      },
    })
    await gravarVersao(tx, ctx, ordem.id, versao, dados.concluir ? CONCLUIDA(ctx) : {})
    return resultado(versao, estado, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}

/** "Servico finalizado": a unica acao da producao. Nao toca em dinheiro. */
export async function concluirOrdem(ctx: Contexto, ordemId: string, versao: number): Promise<ResultadoDinheiro> {
  return executarUmaVez(ctx, 'ordem.concluir', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    if (ordem.estadoProducao !== 'aberta') throw new OrdemNaoEditavel(ordem.estadoProducao)
    const estado = transicionar(ordem.estadoProducao, 'concluida')
    await gravarVersao(tx, ctx, ordem.id, versao, CONCLUIDA(ctx))
    return resultado(versao, estado, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}

/** Erro de dinheiro se estorna, nunca se edita nem se apaga: recebimento e lancamento marcados juntos. */
export async function estornarRecebimento(ctx: Contexto, ordemId: string, versao: number, recebimentoId: string, motivo: string): Promise<ResultadoDinheiro> {
  const motivoLimpo = motivo.trim().slice(0, 160)
  if (motivoLimpo === '') throw new ErroDeValidacao('o motivo do estorno é obrigatório')
  return executarUmaVez(ctx, 'recebimento.estornar', async (tx) => {
    const ordem = await carregarComTrava(tx, ctx, ordemId, versao)
    const rec = await tx.recebimento.findFirst({ where: { id: recebimentoId, ordemId: ordem.id, empresaId: ctx.empresaId }, select: { id: true, lancamentoId: true, estornadoEm: true } })
    if (!rec) throw new ErroDeValidacao('recebimento não encontrado')
    if (rec.estornadoEm) throw new ErroDeValidacao('recebimento já estornado')
    const marca = { estornadoEm: new Date(), estornadoPorId: ctx.usuarioId, motivoEstorno: motivoLimpo }
    await tx.recebimento.update({ where: { id: rec.id }, data: marca })
    await tx.lancamentoCaixa.update({ where: { id: rec.lancamentoId }, data: marca })
    await gravarVersao(tx, ctx, ordem.id, versao)
    return resultado(versao, ordem.estadoProducao, await resumo(tx, ctx.empresaId, ordem.id, ordem.precoFinal))
  })
}
```

- [x] **Step 5: Livro-caixa, plano de contas e fila**

`src/infra/caixa/livro.ts`:
```ts
import { paraBanco, paraDominio } from '@/infra/db/decimal'
import { prisma } from '@/infra/db/prisma'
import { executarUmaVez, type Contexto } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { validarSaida, type TipoLancamento } from '@/domain/caixa/lancamento'
import { lerDataCalendario } from '@/domain/ordem/datas'

export interface DadosSaida {
  valor: string
  data: string
  historico: string
  contaId: string
  fornecedor: string
  parcela: string
  totalParcelas: string
}

export async function registrarSaida(ctx: Contexto, dados: DadosSaida): Promise<{ id: string }> {
  return executarUmaVez(ctx, 'caixa.saida', async (tx) => {
    const conta = await tx.contaPlano.findFirst({ where: { id: dados.contaId, empresaId: ctx.empresaId }, select: { id: true, tipo: true, ativa: true } })
    if (!conta) throw new ErroDeValidacao('conta não encontrada')
    const s = validarSaida(dados, conta)
    return tx.lancamentoCaixa.create({
      data: {
        empresaId: ctx.empresaId, data: s.data, tipo: 'saida', valor: paraBanco(s.valor), contaId: conta.id, historico: s.historico,
        fornecedor: dados.fornecedor.trim().slice(0, 120) || null, parcela: s.parcela, totalParcelas: s.totalParcelas, usuarioId: ctx.usuarioId,
      },
      select: { id: true },
    })
  })
}

/** So saida: a entrada se estorna pelo recebimento, na ordem, para os dois andarem juntos. */
export async function estornarLancamento(ctx: Contexto, lancamentoId: string, motivo: string): Promise<{ id: string }> {
  const motivoLimpo = motivo.trim().slice(0, 160)
  if (motivoLimpo === '') throw new ErroDeValidacao('o motivo do estorno é obrigatório')
  return executarUmaVez(ctx, 'caixa.estornar', async (tx) => {
    const l = await tx.lancamentoCaixa.findFirst({ where: { id: lancamentoId, empresaId: ctx.empresaId }, select: { id: true, tipo: true, estornadoEm: true } })
    if (!l) throw new ErroDeValidacao('lançamento não encontrado')
    if (l.tipo === 'entrada') throw new ErroDeValidacao('entrada se estorna pelo recebimento, na ordem')
    if (l.estornadoEm) throw new ErroDeValidacao('lançamento já estornado')
    await tx.lancamentoCaixa.update({ where: { id: l.id }, data: { estornadoEm: new Date(), estornadoPorId: ctx.usuarioId, motivoEstorno: motivoLimpo } })
    return { id: l.id }
  })
}

export interface LinhaLivro {
  id: string
  /** ISO da @db.Date (meia-noite UTC): formatar com formatarDataCalendario. */
  data: string
  tipo: TipoLancamento
  valor: string
  contaCodigo: number
  contaNome: string
  historico: string
  ordemId: string | null
  ordemNumero: number | null
  fornecedor: string | null
  parcela: number | null
  totalParcelas: number | null
  usuarioNome: string
  estornadoEm: string | null
  motivoEstorno: string | null
}

export interface Livro {
  de: string
  ate: string
  linhas: LinhaLivro[]
  /** Somas dos lancamentos vivos, strings com 2 casas. */
  entradas: string
  saidas: string
  saldo: string
}

export async function listarLivro(empresaId: string, periodo: { de: string; ate: string }): Promise<Livro> {
  const de = lerDataCalendario(periodo.de)
  const ate = lerDataCalendario(periodo.ate)
  if (!de || !ate || de.getTime() > ate.getTime()) throw new ErroDeValidacao('período inválido')
  const lancamentos = await prisma.lancamentoCaixa.findMany({
    where: { empresaId, data: { gte: de, lte: ate } },
    orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
    include: { conta: { select: { codigo: true, nome: true } }, ordem: { select: { numero: true } }, usuario: { select: { nome: true } } },
  })
  let entradas = dinheiro(0)
  let saidas = dinheiro(0)
  const linhas = lancamentos.map((l) => {
    const valor = paraDominio(l.valor)
    if (!l.estornadoEm) {
      if (l.tipo === 'entrada') entradas = entradas.plus(valor)
      else saidas = saidas.plus(valor)
    }
    return {
      id: l.id, data: l.data.toISOString(), tipo: l.tipo, valor: valor.toFixed(2), contaCodigo: l.conta.codigo, contaNome: l.conta.nome,
      historico: l.historico, ordemId: l.ordemId, ordemNumero: l.ordem?.numero ?? null, fornecedor: l.fornecedor, parcela: l.parcela,
      totalParcelas: l.totalParcelas, usuarioNome: l.usuario.nome, estornadoEm: l.estornadoEm?.toISOString() ?? null, motivoEstorno: l.motivoEstorno,
    }
  })
  return { de: periodo.de, ate: periodo.ate, linhas, entradas: entradas.toFixed(2), saidas: saidas.toFixed(2), saldo: entradas.minus(saidas).toFixed(2) }
}
```

`src/infra/caixa/plano.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import type { TipoConta } from '@/domain/caixa/lancamento'

export interface ContaTela {
  id: string
  codigo: number
  nome: string
  nivel: number
  tipo: TipoConta
  grupo: string
  ativa: boolean
  /** A conta em que todo recebimento cai. */
  recebeVendas: boolean
}

export async function listarContas(empresaId: string, opcoes: { incluirInativas?: boolean } = {}): Promise<ContaTela[]> {
  const [empresa, contas] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } }),
    prisma.contaPlano.findMany({
      where: { empresaId, ...(opcoes.incluirInativas ? {} : { ativa: true }) },
      orderBy: [{ grupo: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, nome: true, nivel: true, tipo: true, grupo: true, ativa: true },
    }),
  ])
  return contas.map((c) => ({ ...c, recebeVendas: c.id === empresa.contaRecebimentoId }))
}

/** Codigo = maior + 1, dentro da transacao. Nome unico por empresa sem diferenciar maiusculas. */
export async function criarConta(empresaId: string, dados: { nome: string; tipo: string; grupo: string }): Promise<{ id: string }> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ').slice(0, 80)
  const grupo = dados.grupo.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (nome === '') throw new ErroDeValidacao('informe o nome da conta')
  if (dados.tipo !== 'receita' && dados.tipo !== 'despesa') throw new ErroDeValidacao('tipo precisa ser receita ou despesa')
  if (grupo === '') throw new ErroDeValidacao('informe o grupo')
  const tipo: TipoConta = dados.tipo
  return prisma.$transaction(async (tx) => {
    const repetida = await tx.contaPlano.findFirst({ where: { empresaId, nome: { equals: nome, mode: 'insensitive' } }, select: { id: true } })
    if (repetida) throw new ErroDeValidacao('já existe conta com esse nome')
    const ultimo = await tx.contaPlano.aggregate({ where: { empresaId }, _max: { codigo: true } })
    return tx.contaPlano.create({ data: { empresaId, codigo: (ultimo._max.codigo ?? 0) + 1, nome, tipo, grupo }, select: { id: true } })
  })
}

export async function alterarAtiva(empresaId: string, contaId: string, ativa: boolean): Promise<void> {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { contaRecebimentoId: true } })
  if (!ativa && empresa.contaRecebimentoId === contaId) throw new ErroDeValidacao('esta conta recebe as vendas; escolha outra antes de desativar')
  const { count } = await prisma.contaPlano.updateMany({ where: { id: contaId, empresaId }, data: { ativa } })
  if (count === 0) throw new ErroDeValidacao('conta não encontrada')
}

export async function definirContaRecebimento(empresaId: string, contaId: string): Promise<void> {
  const conta = await prisma.contaPlano.findFirst({ where: { id: contaId, empresaId }, select: { tipo: true, ativa: true } })
  if (!conta) throw new ErroDeValidacao('conta não encontrada')
  if (conta.tipo !== 'receita') throw new ErroDeValidacao('a conta que recebe as vendas precisa ser de receita')
  if (!conta.ativa) throw new ErroDeValidacao('a conta está desativada')
  await prisma.empresa.update({ where: { id: empresaId }, data: { contaRecebimentoId: contaId } })
}
```

`src/infra/caixa/fila.ts`:
```ts
import { prisma } from '@/infra/db/prisma'
import { paraDominio } from '@/infra/db/decimal'
import { classificarFila, type Fila, type OrdemDaFila } from '@/domain/caixa/fila'
import { totalRecebidoPorOrdem } from './resumo'

/** Abertas e concluidas da empresa, com o total recebido de cada uma, classificadas pelo dominio. */
export async function carregarFila(empresaId: string, agora: Date = new Date()): Promise<Fila> {
  const ordens = await prisma.ordemServico.findMany({
    where: { empresaId, estadoProducao: { in: ['aberta', 'concluida'] } },
    select: { id: true, numero: true, clienteNome: true, clienteApelido: true, estadoProducao: true, abertaEm: true, concluidaEm: true, prometidaPara: true, precoFinal: true },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, ordens.map((o) => o.id))
  const lista: OrdemDaFila[] = ordens.map((o) => ({
    id: o.id, numero: o.numero, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido, estadoProducao: o.estadoProducao,
    abertaEm: o.abertaEm.toISOString(), concluidaEm: o.concluidaEm?.toISOString() ?? null, prometidaPara: o.prometidaPara?.toISOString() ?? null,
    precoFinal: paraDominio(o.precoFinal).toFixed(2), totalRecebido: totais.get(o.id) ?? '0.00',
  }))
  return classificarFila(lista, agora)
}
```

- [x] **Step 6: A tela da ordem e a lista ganham o eixo de pagamento**

Em `src/infra/ordens/tela.ts`:
- imports novos: `import { resumirPagamento } from '@/domain/caixa/pagamento'`, `import type { EstadoPagamento } from '@/domain/ordem/estados'`, `import type { FormaPagamento } from '@/domain/caixa/formas'`, `import { limitesDoDia } from '@/domain/ordem/datas'`, `import { totalRecebidoPorOrdem } from '@/infra/caixa/resumo'`.
- em `OrdemTela`, acrescentar:
```ts
  concluidaEm: string | null
  pagamento: { estado: EstadoPagamento; totalRecebido: string; saldo: string }
  recebimentos: RecebimentoTela[]
```
e o tipo:
```ts
export interface RecebimentoTela {
  id: string
  /** ISO da @db.Date. */
  data: string
  valor: string
  forma: FormaPagamento
  observacao: string | null
  usuario: string
  estornadoEm: string | null
  motivoEstorno: string | null
}
```
- em `obterOrdemParaTela`, no `include`, acrescentar `recebimentos: { orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }], include: { usuario: { select: { nome: true } } } }` e, depois de `if (!o) return null`:
```ts
  const vivos = o.recebimentos.filter((r) => r.estornadoEm === null).map((r) => paraDominio(r.valor).toFixed())
  const pagamento = resumirPagamento(paraDominio(o.precoFinal).toFixed(), vivos)
```
e no objeto devolvido:
```ts
    concluidaEm: o.concluidaEm?.toISOString() ?? null,
    pagamento: { estado: pagamento.estado, totalRecebido: pagamento.totalRecebido.toFixed(2), saldo: pagamento.saldo.toFixed(2) },
    recebimentos: o.recebimentos.map((r) => ({
      id: r.id, data: r.data.toISOString(), valor: d2(r.valor), forma: r.forma, observacao: r.observacao, usuario: r.usuario.nome,
      estornadoEm: r.estornadoEm?.toISOString() ?? null, motivoEstorno: r.motivoEstorno,
    })),
```
- `OrdemResumo` ganha `estadoPagamento: EstadoPagamento` e `saldo: string`; `listarOrdens` vira:
```ts
export interface FiltrosOrdens {
  /** Numero da OS (so digitos) ou trecho do nome/apelido do cliente. */
  q?: string
  estado?: EstadoProducao
  /** 'AAAA-MM-DD', sobre aberta_em no calendario de Sao Paulo. */
  de?: string
  ate?: string
  limite?: number
}

export async function listarOrdens(empresaId: string, filtros: FiltrosOrdens = {}): Promise<OrdemResumo[]> {
  const q = filtros.q?.trim() ?? ''
  const periodo = filtros.de && filtros.ate ? limitesDoDia(filtros.de, filtros.ate) : null
  if (filtros.de && filtros.ate && !periodo) return []
  const linhas = await prisma.ordemServico.findMany({
    where: {
      empresaId,
      ...(filtros.estado ? { estadoProducao: filtros.estado } : {}),
      ...(periodo ? { abertaEm: { gte: periodo.inicio, lt: periodo.fim } } : {}),
      ...(q === '' ? {} : /^\d+$/.test(q)
        ? { numero: Number(q) }
        : { OR: [{ clienteNome: { contains: q, mode: 'insensitive' } }, { clienteApelido: { contains: q, mode: 'insensitive' } }] }),
    },
    orderBy: { numero: 'desc' },
    take: filtros.limite ?? 100,
    select: { id: true, numero: true, estadoProducao: true, clienteNome: true, clienteApelido: true, abertaEm: true, prometidaPara: true, precoFinal: true },
  })
  const totais = await totalRecebidoPorOrdem(prisma, empresaId, linhas.map((o) => o.id))
  return linhas.map((o) => {
    const p = resumirPagamento(paraDominio(o.precoFinal).toFixed(), [totais.get(o.id) ?? '0.00'])
    return {
      id: o.id, numero: o.numero, estadoProducao: o.estadoProducao, clienteNome: o.clienteNome, clienteApelido: o.clienteApelido,
      abertaEm: o.abertaEm.toISOString(), prometidaPara: o.prometidaPara?.toISOString() ?? null, precoFinal: d2(o.precoFinal),
      estadoPagamento: p.estado, saldo: p.saldo.toFixed(2),
    }
  })
}
```

Run: `npm run typecheck` → sem erros. Run: `npm run test:int` → PASS (37 anteriores + 1 do plano + 13 de dinheiro = **51**). Run: `npm test` → PASS.

- [x] **Step 7: Commit**

```bash
git add src/infra/ordens/erros.ts src/infra/ordens/repositorio.ts src/infra/ordens/tela.ts src/infra/caixa src/domain/ordem/datas.ts src/domain/ordem/datas.test.ts
git commit -m "feat: recebimento com lancamento no caixa na mesma transacao, concluir e receber, estorno, livro-caixa, plano de contas e fila"
```

**Executado (29/08/2026).** 265 unitarios e **56** de integracao verdes, typecheck limpo.
A conta de 51 no Step 6 estava defasada: a base ja era 41 (os 37 mais os 4 testes dos ids
reconferidos da revisao da Fase 3) e o `dinheiro.int.test.ts` tem 14 testes, nao 13 —
41 + 1 + 14 = 56. Nenhum teste precisou de ajuste; o codigo do plano rodou como escrito.

---
### Task 4: Telas — painel de pagamento na ordem, fila de trabalho, lista com os dois eixos, financeiro e plano de contas

**Files:**
- Modify: `src/app/(app)/navegacao.ts`, `src/app/(app)/layout.tsx` (ícones), `src/app/(app)/page.tsx` (fila), `src/app/(app)/ordens/page.tsx` (filtros e eixo de pagamento), `src/app/(app)/ordens/[id]/page.tsx` (painel), `src/app/(app)/ordens/[id]/actions.ts` (actions de dinheiro)
- Create: `src/app/(app)/ordens/[id]/painel-pagamento.tsx`, `src/app/(app)/financeiro/page.tsx`, `src/app/(app)/financeiro/actions.ts`, `src/app/(app)/financeiro/botao-estorno.tsx`, `src/app/(app)/financeiro/saida/page.tsx`, `src/app/(app)/financeiro/saida/form-saida.tsx`, `src/app/(app)/plano-de-contas/page.tsx`, `src/app/(app)/plano-de-contas/actions.ts`, `src/app/(app)/plano-de-contas/form-conta.tsx`, `src/app/(app)/plano-de-contas/acoes-conta.tsx`

**Interfaces:**
- Consumes: tudo da Task 3; `gerarChave`; `BotaoMutacao` (recebe `acao: (chave) => Promise<Resposta>` — para as actions de dinheiro usa-se o `PainelPagamento`, que tem o próprio botão); `exigirPapel('administracao')` (redireciona para `/` quem não é); `formatarMoeda`, `dinheiro`, `formatarDataCalendario`, `formatarDataHora`, `hojeCalendario`, `mesCalendario`, `ROTULO_ESTADO`, `ROTULO_PAGAMENTO`, `ROTULO_FORMA`, `FORMAS_PAGAMENTO`, `ROTULO_TIPO_CONTA`, `formatarNumeroOs`.
- Produces: rotas `/` (fila), `/ordens?q=&estado=&de=&ate=`, `/ordens/[id]` com painel de pagamento, `/financeiro?de=&ate=`, `/financeiro/saida`, `/plano-de-contas`; `type RespostaDinheiro = { ok: true; resultado: ResultadoDinheiro } | { ok: false; conflito: true } | { ok: false; conflito?: false; erro: string }`; actions `registrarRecebimentoAction`, `concluirOrdemAction`, `estornarRecebimentoAction`, `registrarSaidaAction`, `estornarLancamentoAction`, `criarContaAction`, `alterarAtivaAction`, `definirContaRecebimentoAction`; `type RespostaSimples = { ok: true } | { ok: false; erro: string }`.

- [ ] **Step 1: Navegação**

Em `navegacao.ts`: o tipo `icone` vira `'fila' | 'ordens' | 'clientes' | 'materiais' | 'financeiro' | 'plano'` e, depois de "Materiais e preços":
```ts
  { href: '/financeiro', titulo: 'Financeiro', icone: 'financeiro', papel: 'administracao' },
  { href: '/plano-de-contas', titulo: 'Plano de contas', icone: 'plano', papel: 'administracao' },
```
Em `layout.tsx`: importar `IconCash, IconListTree` de `@tabler/icons-react` e acrescentar a `ICONES`: `financeiro: <IconCash className="icon" />, plano: <IconListTree className="icon" />`.

- [ ] **Step 2: Actions de dinheiro da ordem**

Acrescentar a `src/app/(app)/ordens/[id]/actions.ts` (imports no topo; funções no fim):
```ts
import { registrarRecebimento, concluirOrdem, estornarRecebimento, type DadosRecebimento, type ResultadoDinheiro } from '@/infra/caixa/recebimentos'

export type RespostaDinheiro =
  | { ok: true; resultado: ResultadoDinheiro }
  | { ok: false; conflito: true }
  | { ok: false; conflito?: false; erro: string }

async function executarDinheiro(ordemId: string, chave: string, soAdministracao: boolean, corpo: (ctx: Contexto) => Promise<ResultadoDinheiro>): Promise<RespostaDinheiro> {
  const usuario = await exigirUsuario()
  if (soAdministracao && usuario.papel !== 'administracao') return { ok: false, erro: 'Só a administração registra e estorna recebimentos.' }
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    const resultado = await corpo({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave })
    revalidatePath(`/ordens/${ordemId}`)
    revalidatePath('/')
    revalidatePath('/financeiro')
    return { ok: true, resultado }
  } catch (e) {
    if (e instanceof ordens.ConflitoVersao) return { ok: false, conflito: true }
    if (e instanceof ordens.OrdemNaoEditavel) return { ok: false, erro: 'Esta ordem não aceita essa ação no estado atual.' }
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function registrarRecebimentoAction(ordemId: string, versao: number, chave: string, dados: DadosRecebimento): Promise<RespostaDinheiro> {
  return executarDinheiro(ordemId, chave, true, (ctx) => registrarRecebimento(ctx, ordemId, versao, dados))
}
export async function concluirOrdemAction(ordemId: string, versao: number, chave: string): Promise<RespostaDinheiro> {
  return executarDinheiro(ordemId, chave, false, (ctx) => concluirOrdem(ctx, ordemId, versao))
}
export async function estornarRecebimentoAction(ordemId: string, versao: number, chave: string, recebimentoId: string, motivo: string): Promise<RespostaDinheiro> {
  return executarDinheiro(ordemId, chave, true, (ctx) => estornarRecebimento(ctx, ordemId, versao, recebimentoId, motivo))
}
```

- [ ] **Step 3: O painel de pagamento (Client Component)**

`src/app/(app)/ordens/[id]/painel-pagamento.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { FORMAS_PAGAMENTO, ROTULO_FORMA } from '@/domain/caixa/formas'
import { ROTULO_PAGAMENTO } from '@/domain/caixa/pagamento'
import type { EstadoPagamento, EstadoProducao } from '@/domain/ordem/estados'
import { formatarDataCalendario } from '@/domain/ordem/datas'
import type { RecebimentoTela } from '@/infra/ordens/repositorio'
import { registrarRecebimentoAction, concluirOrdemAction, estornarRecebimentoAction, type RespostaDinheiro } from './actions'
import { gerarChave } from './chave'

interface Props {
  ordemId: string
  versao: number
  estadoProducao: EstadoProducao
  pagamento: { estado: EstadoPagamento; totalRecebido: string; saldo: string }
  recebimentos: RecebimentoTela[]
  /** 'AAAA-MM-DD' de hoje em Sao Paulo, calculado no servidor. */
  hoje: string
  podeConcluir: boolean
  podeReceber: boolean
  administracao: boolean
}

const COR_PAGAMENTO = { nao_pago: 'bg-danger-lt', parcial: 'bg-warning-lt', pago: 'bg-success-lt' } as const
const moeda = (v: string) => `R$ ${v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export function PainelPagamento(p: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<RespostaDinheiro | null>(null)
  const chave = useRef(gerarChave())
  const [valor, setValor] = useState(p.pagamento.saldo.replace('.', ','))
  const [forma, setForma] = useState('')
  const [data, setData] = useState(p.hoje)
  const [observacao, setObservacao] = useState('')
  const [estornando, setEstornando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  function tratar(r: RespostaDinheiro) {
    setResposta(r)
    if (r.ok) {
      chave.current = gerarChave()
      setValor(r.resultado.saldo.replace('.', ','))
      setForma(''); setObservacao(''); setEstornando(null); setMotivo('')
      iniciar(() => router.refresh())
    } else if (r.conflito) {
      router.refresh()
    } else {
      chave.current = gerarChave()
    }
  }

  function receber(e: FormEvent<HTMLFormElement>, concluir: boolean) {
    e.preventDefault()
    if (pendente) return
    iniciar(async () => tratar(await registrarRecebimentoAction(p.ordemId, p.versao, chave.current, { valor, forma, data, observacao, concluir })))
  }

  function concluir() {
    if (pendente) return
    iniciar(async () => tratar(await concluirOrdemAction(p.ordemId, p.versao, chave.current)))
  }

  function estornar(e: FormEvent<HTMLFormElement>, recebimentoId: string) {
    e.preventDefault()
    if (pendente) return
    iniciar(async () => tratar(await estornarRecebimentoAction(p.ordemId, p.versao, chave.current, recebimentoId, motivo)))
  }

  const erro = resposta && !resposta.ok && !resposta.conflito ? resposta.erro : null
  const conflito = resposta !== null && !resposta.ok && resposta.conflito === true
  const aberta = p.estadoProducao === 'aberta'

  return (
    <div className="card" aria-busy={pendente}>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          <h3 className="card-title mb-0">Pagamento</h3>
          <span className={`badge ${COR_PAGAMENTO[p.pagamento.estado]}`} data-testid="estado-pagamento">{ROTULO_PAGAMENTO[p.pagamento.estado]}</span>
        </div>
        <dl className="row mb-0 mt-2">
          <dt className="col-7">Recebido</dt><dd className="col-5 numero">{moeda(p.pagamento.totalRecebido)}</dd>
          <dt className="col-7">Saldo a receber</dt><dd className="col-5 numero fw-bold" data-testid="saldo">{moeda(p.pagamento.saldo)}</dd>
        </dl>
        {conflito ? <div className="alert alert-warning mt-2 mb-0" role="alert">A ordem mudou. Recarregando…</div> : null}
      </div>

      {p.podeReceber && p.administracao && p.pagamento.estado !== 'pago' ? (
        <form className="card-body border-top d-flex flex-column gap-2" onSubmit={(e) => receber(e, aberta)}>
          <label className="form-label mb-0" htmlFor="valorRecebido">Valor recebido</label>
          <div className="input-group">
            <span className="input-group-text">R$</span>
            <input id="valorRecebido" className="form-control numero" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <label className="form-label mb-0" htmlFor="formaPagamento">Forma de pagamento</label>
          <select id="formaPagamento" className="form-select" value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="">Escolha a forma</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{ROTULO_FORMA[f]}</option>)}
          </select>
          <label className="form-label mb-0" htmlFor="dataRecebimento">Data</label>
          <input id="dataRecebimento" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
          <label className="form-label mb-0" htmlFor="observacaoRecebimento">Observação</label>
          <input id="observacaoRecebimento" className="form-control" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="opcional" />
          <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? 'Gravando…' : aberta ? 'Concluir e receber' : 'Receber'}</button>
          {aberta ? (
            <button type="button" className="btn btn-link px-0" disabled={pendente}
              onClick={(e) => receber(e as unknown as FormEvent<HTMLFormElement>, false)}>
              Só receber — a ordem continua aberta
            </button>
          ) : null}
          {erro ? <div className="text-danger small" role="alert">{erro}</div> : null}
        </form>
      ) : null}

      {p.podeConcluir ? (
        <div className="card-body border-top">
          <button type="button" className="btn" disabled={pendente} onClick={concluir}>Serviço finalizado</button>
          <div className="form-hint">Marca a produção como pronta. Não mexe em dinheiro.</div>
          {!p.administracao && erro ? <div className="text-danger small" role="alert">{erro}</div> : null}
        </div>
      ) : null}

      {p.recebimentos.length > 0 ? (
        <div className="table-responsive border-top">
          <table className="table table-sm card-table" aria-label="Recebimentos">
            <thead><tr><th>Data</th><th>Forma</th><th className="text-end">Valor</th><th className="w-1"></th></tr></thead>
            <tbody>
              {p.recebimentos.map((r) => (
                <tr key={r.id} className={r.estornadoEm ? 'text-secondary' : ''}>
                  <td>{formatarDataCalendario(new Date(r.data))}{r.observacao ? <div className="small">{r.observacao}</div> : null}{r.estornadoEm ? <div className="small">estornado · {r.motivoEstorno}</div> : null}</td>
                  <td>{ROTULO_FORMA[r.forma]}<div className="small">{r.usuario}</div></td>
                  <td className={`numero ${r.estornadoEm ? 'text-decoration-line-through' : ''}`}>{moeda(r.valor)}</td>
                  <td>
                    {p.administracao && !r.estornadoEm && estornando !== r.id ? (
                      <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => { setEstornando(r.id); setMotivo('') }}>Estornar</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {estornando ? (
            <form className="card-body d-flex flex-column gap-2" onSubmit={(e) => estornar(e, estornando)}>
              <label className="form-label mb-0" htmlFor="motivoEstorno">Motivo do estorno</label>
              <input id="motivoEstorno" className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-danger" disabled={pendente}>Confirmar estorno</button>
                <button type="button" className="btn btn-link" onClick={() => setEstornando(null)}>Voltar</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
```
(O botão "Só receber" chama `receber` com um evento sintético só para reaproveitar o `preventDefault`; o `as unknown as` é aceito pelo TS 7. Se o typecheck reclamar, trocar por uma função `enviar(concluir: boolean)` sem evento chamada pelos dois botões, e `onSubmit={(e) => { e.preventDefault(); enviar(aberta) }}`.)

- [ ] **Step 4: A página da ordem mostra os dois eixos e o painel**

Em `src/app/(app)/ordens/[id]/page.tsx`:
- imports: `import { PainelPagamento } from './painel-pagamento'`, `import { ROTULO_PAGAMENTO } from '@/domain/caixa/pagamento'`, `import { hojeCalendario } from '@/domain/ordem/datas'` (acrescentar ao import existente de `datas`).
- no `page-pretitle`, depois do estado de produção: `{' · '}{ROTULO_PAGAMENTO[ordem.pagamento.estado]}` e, se `ordem.concluidaEm`, `{' · serviço finalizado em '}{formatarDataHora(new Date(ordem.concluidaEm))}`.
- na coluna da direita, **antes** do `<div className="card">` dos totais, inserir:
```tsx
              <div className="mb-3">
                <PainelPagamento ordemId={ordem.id} versao={ordem.versao} estadoProducao={ordem.estadoProducao} pagamento={ordem.pagamento}
                  recebimentos={ordem.recebimentos} hoje={hojeCalendario(new Date())} podeConcluir={pode.concluir} podeReceber={pode.receber}
                  administracao={usuario.papel === 'administracao'} />
              </div>
```

- [ ] **Step 5: Lista de ordens com filtros e eixo de pagamento**

Em `src/app/(app)/ordens/page.tsx`:
- assinatura: `export default async function PaginaOrdens({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string }> })`, e:
```tsx
  const { q = '', estado = '', de = '', ate = '' } = await searchParams
  const estadoValido = (['orcamento', 'aberta', 'concluida', 'cancelada'] as const).find((e) => e === estado)
  const ordens = await listarOrdens(usuario.empresaId, { q, estado: estadoValido, de: de || undefined, ate: ate || undefined })
```
- imports novos: `import { ROTULO_PAGAMENTO } from '@/domain/caixa/pagamento'` e `const COR_PAGAMENTO = { nao_pago: 'bg-danger-lt', parcial: 'bg-warning-lt', pago: 'bg-success-lt' } as const`.
- antes da tabela (dentro do `container-xl`), o filtro por GET:
```tsx
          <form method="get" className="card mb-3" role="search">
            <div className="card-body row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label" htmlFor="q">Buscar</label>
                <input id="q" type="search" name="q" className="form-control" defaultValue={q} placeholder="Número, cliente ou apelido" />
              </div>
              <div className="col-md-2">
                <label className="form-label" htmlFor="estado">Situação</label>
                <select id="estado" name="estado" className="form-select" defaultValue={estado}>
                  <option value="">Todas</option>
                  {(['orcamento', 'aberta', 'concluida', 'cancelada'] as const).map((e) => <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>)}
                </select>
              </div>
              <div className="col-md-2"><label className="form-label" htmlFor="de">Aberta de</label><input id="de" type="date" name="de" className="form-control" defaultValue={de} /></div>
              <div className="col-md-2"><label className="form-label" htmlFor="ate">até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={ate} /></div>
              <div className="col-md-2 d-flex gap-2"><button type="submit" className="btn btn-primary">Filtrar</button><Link href="/ordens" className="btn">Limpar</Link></div>
            </div>
          </form>
```
- o vazio: `{q || estado || de ? 'Nenhuma ordem com esse filtro' : 'Nenhuma ordem ainda'}` no `empty-title`.
- na tabela: coluna `<th>Pagamento</th>` depois de "Situação", e na linha:
```tsx
                      <td><span className={`badge ${COR_PAGAMENTO[o.estadoPagamento]}`}>{ROTULO_PAGAMENTO[o.estadoPagamento]}</span>{o.estadoPagamento === 'parcial' ? <span className="small text-secondary ms-2">falta {formatarMoeda(dinheiro(o.saldo))}</span> : null}</td>
```

- [ ] **Step 6: A fila de trabalho**

`src/app/(app)/page.tsx` inteiro:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconSearch } from '@tabler/icons-react'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { carregarFila } from '@/infra/caixa/fila'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { formatarDataCalendario, formatarDataHora } from '@/domain/ordem/datas'
import type { OrdemDaFila } from '@/domain/caixa/fila'

export const metadata: Metadata = { title: 'Fila de trabalho' }

function Cliente({ o }: { o: OrdemDaFila }) {
  return <>{o.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}{o.clienteApelido ? <span className="badge bg-primary-lt ms-2">{o.clienteApelido}</span> : null}</>
}

export default async function PaginaFila() {
  const usuario = await exigirUsuario()
  const fila = await carregarFila(usuario.empresaId)

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Atendimento</div>
              <h2 className="page-title">Fila de trabalho</h2>
            </div>
            <div className="col-auto"><Link href="/ordens/nova" className="btn btn-primary">Nova ordem</Link></div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" action="/ordens" className="mb-3" role="search">
            <div className="input-icon">
              <span className="input-icon-addon"><IconSearch className="icon" /></span>
              <input type="search" name="q" className="form-control form-control-lg" placeholder="Número da OS, cliente ou apelido" aria-label="Buscar ordem" autoFocus />
            </div>
          </form>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header"><h3 className="card-title">Abertas há mais de uma semana</h3><span className="badge bg-secondary-lt ms-auto">{fila.paradas.length}</span></div>
                {fila.paradas.length === 0 ? (
                  <div className="card-body text-secondary">Nenhuma ordem parada. É assim que deve ficar.</div>
                ) : (
                  <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens paradas">
                    <thead><tr><th>Nº</th><th>Cliente</th><th>Aberta em</th><th>Entrega</th></tr></thead>
                    <tbody>{fila.paradas.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{formatarNumeroOs(o.numero)}</Link></td>
                        <td><Cliente o={o} /></td>
                        <td className="text-secondary">{formatarDataHora(new Date(o.abertaEm))}</td>
                        <td className="text-secondary">{o.prometidaPara ? formatarDataCalendario(new Date(o.prometidaPara)) : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header"><h3 className="card-title">Concluídas e não pagas</h3><span className="ms-auto fw-bold numero" data-testid="total-a-cobrar">{formatarMoeda(dinheiro(fila.totalACobrar))}</span></div>
                {fila.aCobrar.length === 0 ? (
                  <div className="card-body text-secondary">Nada a cobrar. Todo serviço finalizado já foi recebido.</div>
                ) : (
                  <div className="table-responsive"><table className="table table-vcenter card-table" aria-label="Ordens a cobrar">
                    <thead><tr><th>Nº</th><th>Cliente</th><th>Finalizada em</th><th className="text-end">Falta</th></tr></thead>
                    <tbody>{fila.aCobrar.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/ordens/${o.id}`} className="text-reset fw-medium">{formatarNumeroOs(o.numero)}</Link></td>
                        <td><Cliente o={o} /></td>
                        <td className="text-secondary">{o.concluidaEm ? formatarDataHora(new Date(o.concluidaEm)) : '—'}</td>
                        <td className="numero">{formatarMoeda(dinheiro(o.saldo))}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 7: Financeiro — livro-caixa, nova saída e estorno**

`src/app/(app)/financeiro/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { chaveValida } from '@/infra/mutacoes/idempotencia'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { registrarSaida, estornarLancamento, type DadosSaida } from '@/infra/caixa/livro'

export type RespostaSimples = { ok: true } | { ok: false; erro: string }

async function executar(chave: string, corpo: (ctx: { empresaId: string; usuarioId: string; chave: string }) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  if (!chaveValida(chave)) return { ok: false, erro: 'Chave de idempotência inválida.' }
  try {
    await corpo({ empresaId: usuario.empresaId, usuarioId: usuario.id, chave })
    revalidatePath('/financeiro')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function registrarSaidaAction(chave: string, dados: DadosSaida): Promise<RespostaSimples> {
  return executar(chave, (ctx) => registrarSaida(ctx, dados))
}
export async function estornarLancamentoAction(chave: string, lancamentoId: string, motivo: string): Promise<RespostaSimples> {
  return executar(chave, (ctx) => estornarLancamento(ctx, lancamentoId, motivo))
}
```

`src/app/(app)/financeiro/botao-estorno.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { estornarLancamentoAction } from './actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

export function BotaoEstorno({ lancamentoId }: { lancamentoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const chave = useRef(gerarChave())

  if (!aberto) return <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setAberto(true)}>Estornar</button>
  return (
    <form className="d-flex gap-2 align-items-center" onSubmit={(e) => {
      e.preventDefault()
      iniciar(async () => {
        const r = await estornarLancamentoAction(chave.current, lancamentoId, motivo)
        if (r.ok) { setAberto(false); iniciar(() => router.refresh()) }
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <input className="form-control form-control-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do estorno" aria-label="Motivo do estorno" required autoFocus />
      <button type="submit" className="btn btn-danger btn-sm" disabled={pendente}>Confirmar</button>
      <button type="button" className="btn btn-link btn-sm" onClick={() => setAberto(false)}>Voltar</button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </form>
  )
}
```

`src/app/(app)/financeiro/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { IconPlus } from '@tabler/icons-react'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarLivro } from '@/infra/caixa/livro'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { formatarMoeda } from '@/domain/precificacao/moeda'
import { dinheiro } from '@/domain/precificacao/dinheiro'
import { formatarDataCalendario, mesCalendario } from '@/domain/ordem/datas'
import { formatarNumeroOs, ROTULO_TIPO_LANCAMENTO } from '@/domain/caixa/lancamento'
import { BotaoEstorno } from './botao-estorno'

export const metadata: Metadata = { title: 'Financeiro' }

export default async function PaginaFinanceiro({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const mes = mesCalendario(new Date())
  const { de = mes.de, ate = mes.ate } = await searchParams
  let livro
  let erro: string | null = null
  try {
    livro = await listarLivro(usuario.empresaId, { de, ate })
  } catch (e) {
    if (!(e instanceof ErroDeValidacao)) throw e
    erro = e.message
    livro = await listarLivro(usuario.empresaId, mes)
  }
  const R$ = (v: string) => formatarMoeda(dinheiro(v))

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col"><div className="page-pretitle">Administração</div><h2 className="page-title">Livro-caixa</h2></div>
            <div className="col-auto"><Link href="/financeiro/saida" className="btn btn-primary"><IconPlus className="icon" /> Nova saída</Link></div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          <form method="get" className="card mb-3">
            <div className="card-body row g-2 align-items-end">
              <div className="col-md-3"><label className="form-label" htmlFor="de">De</label><input id="de" type="date" name="de" className="form-control" defaultValue={livro.de} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="ate">Até</label><input id="ate" type="date" name="ate" className="form-control" defaultValue={livro.ate} /></div>
              <div className="col-md-2"><button type="submit" className="btn btn-primary">Mostrar</button></div>
              {erro ? <div className="col-12 text-danger small" role="alert">{erro} — mostrando o mês atual.</div> : null}
            </div>
          </form>

          <div className="row g-3 mb-3">
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Entradas</div><div className="h2 mb-0 numero" data-testid="entradas">{R$(livro.entradas)}</div></div></div></div>
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Saídas</div><div className="h2 mb-0 numero" data-testid="saidas">{R$(livro.saidas)}</div></div></div></div>
            <div className="col-md-4"><div className="card card-sm"><div className="card-body"><div className="subheader">Saldo do período</div><div className="h2 mb-0 numero" data-testid="saldo-periodo">{R$(livro.saldo)}</div></div></div></div>
          </div>

          {livro.linhas.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Nenhum lançamento no período</p>
              <p className="empty-subtitle text-secondary">Entradas nascem dos recebimentos, na ordem. Saídas você lança aqui.</p>
              <div className="empty-action"><Link href="/financeiro/saida" className="btn btn-primary">Nova saída</Link></div>
            </div></div></div>
          ) : (
            <div className="card"><div className="table-responsive">
              <table className="table table-vcenter card-table" aria-label="Lançamentos">
                <thead><tr><th>Data</th><th>Tipo</th><th>Histórico</th><th>Conta</th><th>Quem</th><th className="text-end">Valor</th><th className="w-1"></th></tr></thead>
                <tbody>
                  {livro.linhas.map((l) => (
                    <tr key={l.id} className={l.estornadoEm ? 'text-secondary' : ''}>
                      <td>{formatarDataCalendario(new Date(l.data))}</td>
                      <td><span className={`badge ${l.tipo === 'entrada' ? 'bg-success-lt' : 'bg-danger-lt'}`}>{ROTULO_TIPO_LANCAMENTO[l.tipo]}</span></td>
                      <td>
                        {l.ordemId ? <Link href={`/ordens/${l.ordemId}`} className="text-reset">{l.historico}</Link> : l.historico}
                        {l.fornecedor ? <div className="small text-secondary">{l.fornecedor}</div> : null}
                        {l.parcela ? <div className="small text-secondary">parcela {l.parcela}/{l.totalParcelas}</div> : null}
                        {l.estornadoEm ? <div className="small">estornado · {l.motivoEstorno}</div> : null}
                      </td>
                      <td className="text-secondary">{l.contaCodigo} · {l.contaNome}</td>
                      <td className="text-secondary">{l.usuarioNome}</td>
                      <td className={`numero ${l.estornadoEm ? 'text-decoration-line-through' : ''}`}>{l.tipo === 'saida' ? '−' : ''}{R$(l.valor)}</td>
                      <td>{l.tipo === 'saida' && !l.estornadoEm ? <BotaoEstorno lancamentoId={l.id} /> : l.ordemNumero ? <span className="small text-secondary">OS {formatarNumeroOs(l.ordemNumero)}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </div>
      </div>
    </>
  )
}
```

`src/app/(app)/financeiro/saida/form-saida.tsx`:
```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registrarSaidaAction } from '../actions'
import { gerarChave } from '@/app/(app)/ordens/[id]/chave'

interface Props {
  hoje: string
  contas: Array<{ id: string; codigo: number; nome: string; grupo: string }>
}

export function FormSaida({ hoje, contas }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const chave = useRef(gerarChave())
  const [data, setData] = useState(hoje)
  const [valor, setValor] = useState('')
  const [contaId, setContaId] = useState('')
  const [historico, setHistorico] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [parcela, setParcela] = useState('')
  const [totalParcelas, setTotalParcelas] = useState('')
  const grupos = [...new Set(contas.map((c) => c.grupo))]

  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await registrarSaidaAction(chave.current, { valor, data, historico, contaId, fornecedor, parcela, totalParcelas })
        if (r.ok) router.push('/financeiro')
        else { chave.current = gerarChave(); setErro(r.erro) }
      })
    }}>
      <div className="card-body row g-3">
        <div className="col-md-3"><label className="form-label" htmlFor="data">Data</label><input id="data" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <div className="col-md-3">
          <label className="form-label" htmlFor="valor">Valor</label>
          <div className="input-group"><span className="input-group-text">R$</span><input id="valor" className="form-control numero" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></div>
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="conta">Conta</label>
          <select id="conta" className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Escolha a conta</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                {contas.filter((c) => c.grupo === g).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-md-8"><label className="form-label" htmlFor="historico">Histórico</label><input id="historico" className="form-control" value={historico} onChange={(e) => setHistorico(e.target.value)} placeholder="Chapa ACM, solvente, mídia" /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="fornecedor">Fornecedor</label><input id="fornecedor" className="form-control" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="opcional" /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="parcela">Parcela</label><input id="parcela" className="form-control numero" inputMode="numeric" value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="2" /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="totalParcelas">de</label><input id="totalParcelas" className="form-control numero" inputMode="numeric" value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="3" /></div>
        <div className="col-12 form-hint">A compra parcelada entra uma vez por parcela, cada uma na sua data. Vazio quando não é parcelado.</div>
      </div>
      <div className="card-footer d-flex align-items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? 'Gravando…' : 'Lançar saída'}</button>
        <a href="/financeiro" className="btn btn-link">Cancelar</a>
        {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
      </div>
    </form>
  )
}
```

`src/app/(app)/financeiro/saida/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarContas } from '@/infra/caixa/plano'
import { hojeCalendario } from '@/domain/ordem/datas'
import { FormSaida } from './form-saida'

export const metadata: Metadata = { title: 'Nova saída' }

export default async function PaginaSaida() {
  const usuario = await exigirPapel('administracao')
  const contas = (await listarContas(usuario.empresaId)).filter((c) => c.tipo === 'despesa')
  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl"><div className="page-pretitle">Financeiro</div><h2 className="page-title">Nova saída</h2></div></div>
      <div className="page-body"><div className="container-xl">
        {contas.length === 0 ? (
          <div className="alert alert-warning" role="alert">Nenhuma conta de despesa ativa. Cadastre uma no plano de contas antes de lançar saídas.</div>
        ) : null}
        <FormSaida hoje={hojeCalendario(new Date())} contas={contas.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, grupo: c.grupo }))} />
      </div></div>
    </>
  )
}
```

- [ ] **Step 8: Plano de contas**

`src/app/(app)/plano-de-contas/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { ErroDeValidacao } from '@/domain/precificacao/erros'
import { criarConta, alterarAtiva, definirContaRecebimento } from '@/infra/caixa/plano'
import type { RespostaSimples } from '@/app/(app)/financeiro/actions'

async function executar(corpo: (empresaId: string) => Promise<unknown>): Promise<RespostaSimples> {
  const usuario = await exigirPapel('administracao')
  try {
    await corpo(usuario.empresaId)
    revalidatePath('/plano-de-contas')
    return { ok: true }
  } catch (e) {
    if (e instanceof ErroDeValidacao) return { ok: false, erro: e.message }
    throw e
  }
}

export async function criarContaAction(dados: { nome: string; tipo: string; grupo: string }): Promise<RespostaSimples> {
  return executar((empresaId) => criarConta(empresaId, dados))
}
export async function alterarAtivaAction(contaId: string, ativa: boolean): Promise<RespostaSimples> {
  return executar((empresaId) => alterarAtiva(empresaId, contaId, ativa))
}
export async function definirContaRecebimentoAction(contaId: string): Promise<RespostaSimples> {
  return executar((empresaId) => definirContaRecebimento(empresaId, contaId))
}
```

`src/app/(app)/plano-de-contas/form-conta.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ROTULO_TIPO_CONTA } from '@/domain/caixa/lancamento'
import { criarContaAction } from './actions'

export function FormConta({ grupos }: { grupos: string[] }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [grupo, setGrupo] = useState('')

  return (
    <form className="row g-2 align-items-end" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await criarContaAction({ nome, tipo, grupo })
        if (r.ok) { setNome(''); setTipo(''); setGrupo(''); setErro(null); iniciar(() => router.refresh()) }
        else setErro(r.erro)
      })
    }}>
      <div className="col-md-5"><label className="form-label" htmlFor="nomeConta">Nova conta</label><input id="nomeConta" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="MARKETING DIGITAL" /></div>
      <div className="col-md-2">
        <label className="form-label" htmlFor="tipoConta">Tipo</label>
        <select id="tipoConta" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Escolha</option>
          {(['receita', 'despesa'] as const).map((t) => <option key={t} value={t}>{ROTULO_TIPO_CONTA[t]}</option>)}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label" htmlFor="grupoConta">Grupo</label>
        <input id="grupoConta" className="form-control" list="grupos" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="DESPESAS" />
        <datalist id="grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
      <div className="col-md-2"><button type="submit" className="btn btn-primary w-100" disabled={pendente}>Criar conta</button></div>
      {erro ? <div className="col-12 text-danger small" role="alert">{erro}</div> : null}
    </form>
  )
}
```

`src/app/(app)/plano-de-contas/acoes-conta.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alterarAtivaAction, definirContaRecebimentoAction } from './actions'

export function AcoesConta({ contaId, ativa, receita, recebeVendas }: { contaId: string; ativa: boolean; receita: boolean; recebeVendas: boolean }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  function rodar(fn: () => ReturnType<typeof alterarAtivaAction>) {
    iniciar(async () => {
      const r = await fn()
      if (r.ok) { setErro(null); iniciar(() => router.refresh()) } else setErro(r.erro)
    })
  }
  return (
    <span className="d-inline-flex align-items-center gap-2">
      {receita && ativa && !recebeVendas ? <button type="button" className="btn btn-sm" disabled={pendente} onClick={() => rodar(() => definirContaRecebimentoAction(contaId))}>Usar para recebimentos</button> : null}
      <button type="button" className="btn btn-sm btn-ghost-secondary" disabled={pendente} onClick={() => rodar(() => alterarAtivaAction(contaId, !ativa))}>{ativa ? 'Desativar' : 'Reativar'}</button>
      {erro ? <span className="text-danger small" role="alert">{erro}</span> : null}
    </span>
  )
}
```

`src/app/(app)/plano-de-contas/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarContas } from '@/infra/caixa/plano'
import { ROTULO_TIPO_CONTA } from '@/domain/caixa/lancamento'
import { FormConta } from './form-conta'
import { AcoesConta } from './acoes-conta'

export const metadata: Metadata = { title: 'Plano de contas' }

export default async function PaginaPlano({ searchParams }: { searchParams: Promise<{ inativas?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { inativas } = await searchParams
  const contas = await listarContas(usuario.empresaId, { incluirInativas: inativas === '1' })
  const grupos = [...new Set(contas.map((c) => c.grupo))]
  const semVendas = !contas.some((c) => c.recebeVendas)

  return (
    <>
      <div className="page-header d-print-none"><div className="container-xl"><div className="page-pretitle">Administração</div><h2 className="page-title">Plano de contas</h2></div></div>
      <div className="page-body">
        <div className="container-xl">
          {semVendas ? <div className="alert alert-warning" role="alert">Nenhuma conta recebe as vendas. Escolha uma conta de receita e clique em "Usar para recebimentos" — sem isso, receber é recusado.</div> : null}
          <div className="card mb-3"><div className="card-body"><FormConta grupos={grupos} /></div></div>
          <form method="get" className="mb-2">
            <label className="form-check"><input className="form-check-input" type="checkbox" name="inativas" value="1" defaultChecked={inativas === '1'} onChange={undefined} /><span className="form-check-label">Mostrar desativadas</span></label>
            <button type="submit" className="btn btn-sm btn-link px-0">Atualizar</button>
          </form>
          {contas.length === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title">Plano de contas vazio</p>
              <p className="empty-subtitle text-secondary">Importe as 48 contas do legado com <code>npm run importar:plano</code> ou crie a primeira acima.</p>
            </div></div></div>
          ) : grupos.map((g) => (
            <div className="card mb-3" key={g}>
              <div className="card-header"><h3 className="card-title">{g}</h3></div>
              <div className="table-responsive"><table className="table table-vcenter card-table" aria-label={`Contas de ${g}`}>
                <thead><tr><th className="w-1">Código</th><th>Conta</th><th>Tipo</th><th className="w-1"></th></tr></thead>
                <tbody>
                  {contas.filter((c) => c.grupo === g).map((c) => (
                    <tr key={c.id} className={c.ativa ? '' : 'text-secondary'}>
                      <td className="numero">{c.codigo}</td>
                      <td>{c.nome}{c.recebeVendas ? <span className="badge bg-success-lt ms-2">recebe as vendas</span> : null}{c.ativa ? null : <span className="badge bg-secondary-lt ms-2">desativada</span>}</td>
                      <td><span className={`badge ${c.tipo === 'receita' ? 'bg-success-lt' : 'bg-danger-lt'}`}>{ROTULO_TIPO_CONTA[c.tipo]}</span></td>
                      <td><AcoesConta contaId={c.id} ativa={c.ativa} receita={c.tipo === 'receita'} recebeVendas={c.recebeVendas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```
(No checkbox de "Mostrar desativadas", o `onChange={undefined}` é só para o React não reclamar de `defaultChecked` — pode ser omitido se não houver aviso.)

- [ ] **Step 9: Typecheck, testes, build e fumaça**

Run: `npm run typecheck` → sem erros. Run: `npm test` → PASS (`use-client` continua verde). Run: `npm run build` → rotas `ƒ /`, `ƒ /financeiro`, `ƒ /financeiro/saida`, `ƒ /plano-de-contas`, `ƒ /ordens`. Fumaça com `next start`: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/financeiro` → `307 …/entrar?proximo=%2Ffinanceiro`.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/"
git commit -m "feat: painel de pagamento na ordem, fila de trabalho, lista com os dois eixos, livro-caixa e plano de contas"
```

---

### Task 5: Ponta a ponta — concluir e receber no balcão, parcial na fila, livro e plano

**Files:**
- Create: `e2e/dinheiro.spec.ts`

- [ ] **Step 1: O teste**

Pré-requisito no banco de desenvolvimento: `npm run importar:plano` já rodado (Task 2, Step 4) — a página do plano precisa listar VENDAS DIVERSAS e o recebimento precisa da conta.

`e2e/dinheiro.spec.ts`:
```ts
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

  test('financeiro: nova saida parcelada no livro do mes, totais e estorno; operacao nao entra', async ({ page }) => {
    await entrar(page)
    await page.goto('/financeiro/saida')
    await page.getByLabel('Valor').fill('45,90')
    await page.getByLabel('Conta').selectOption({ label: '3 · AGUA' })
    await page.getByLabel('Histórico').fill('Conta de água')
    await page.getByLabel('Fornecedor').fill('COPASA')
    await page.getByLabel('Parcela').fill('2')
    await page.getByLabel('de').fill('3')
    await page.getByRole('button', { name: 'Lançar saída' }).click()
    await expect(page).toHaveURL(/\/financeiro$/, { timeout: 30_000 })
    const linha = page.getByRole('row').filter({ hasText: 'Conta de água' }).first()
    await expect(linha).toContainText('COPASA')
    await expect(linha).toContainText('parcela 2/3')
    await expect(linha).toContainText('−R$ 45,90')

    await linha.getByRole('button', { name: 'Estornar' }).click()
    await linha.getByLabel('Motivo do estorno').fill('lançado em duplicidade')
    await linha.getByRole('button', { name: 'Confirmar' }).click()
    await expect(linha).toContainText('estornado · lançado em duplicidade', { timeout: 30_000 })

    await entrarComo(page, LOGIN_OPERACAO, SENHA_OPERACAO)
    await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)
    await page.goto('/financeiro')
    await expect(page).toHaveURL(/\/$/)
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
```

- [ ] **Step 2: Rodar**

Antes: `npm run typecheck`; `npm run db:local:ls` com `drusign` e `drusign-test` de pé; `npm run importar:plano` rodado; `DATABASE_POOL_MAX=2` no `.env.local`.

Run: `npm run e2e`
Expected: **22 passed** (16 anteriores + 6). Se o `next dev` cair com `Connection terminated unexpectedly`, reiniciar o daemon (`npx prisma dev stop drusign && npm run db:local`) e rodar de novo.

- [ ] **Step 3: Commit**

```bash
git add e2e/dinheiro.spec.ts
git commit -m "test: concluir e receber, parcial na fila, estorno, livro-caixa e plano de contas ponta a ponta"
```

---

### Task 6: Verificação final da fase

- [ ] **Step 1: Tudo verde**

Run: `npm run check` → typecheck, unitários (217 + os novos) e integração (**51**) verdes. Run: `npm run build` → verde. Run: `npm run e2e` → 22 passed.

- [ ] **Step 2: Marcar o plano e a memória**

Marcar todos os passos e os critérios de conclusão abaixo; anotar no plano os desvios que a execução exigiu (mesmo formato das notas de execução da Fase 3). Atualizar a memória do projeto (`drusign-sistema-novo.md`): Fase 4 concluída, commit, contagens.

```bash
git add docs/superpowers/plans/2026-08-29-fase4-dinheiro.md
git commit -m "docs: plano da Fase 4 executado"
```

---

## Critério de conclusão da Fase 4

Verificação da spec (seção 13): *"concluir e receber grava os três registros ou nenhum; a fila mostra corretamente 'concluídas e não pagas'. É o marco em que o legado pode ser desligado."*

- [ ] `dinheiro.int.test.ts` verde: "Concluir e receber" grava ordem concluída + recebimento + lançamento de entrada numa transação; com dois recebimentos concorrentes na mesma versão, um grava os três e o outro desfaz tudo (inclusive a chave); sem conta de vendas, nada é gravado
- [ ] eixo de pagamento derivado (`resumirPagamento`): parcial, pago com tolerância de um centavo, saldo nunca negativo, estorno volta a não pago — provado no domínio e no banco
- [ ] `plano-legado.int.test.ts` verde: as 48 contas como estão, em 6 grupos, VENDAS DIVERSAS recebendo as vendas
- [ ] `npm run check` e `npm run build` verdes
- [ ] `npm run e2e` verde: balcão (concluir e receber → livro), parcial (fila mostra o que falta e some quando paga), recusa acima do saldo, estorno riscado, filtros da lista, saída parcelada e estorno no livro, operação sem acesso ao financeiro, plano de contas do legado

Feito isso, a Fase 5 (fila de produção, dashboard de operação, visão administrativa de clientes, usuários e dados da empresa) ganha seu próprio plano.

## Backlog de refinamento (depois que a Odete usar)

Recibo impresso do recebimento; relatório para o contador (Fase 6); edição de nome/grupo de conta; transferência entre caixas (fora de escopo); recebimento por link de pagamento; conciliação bancária; `LogAuditoria`; período do livro por atalhos (mês anterior, trimestre); exportar livro em CSV; "Só receber" como atalho de teclado.
