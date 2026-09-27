# Precificação por família — design

Data: 2026-09-15
Estado: aprovado no brainstorming, pronto para virar plano de implementação

## O problema

O DruSign sabe calcular o preço de um item de ordem (`calcularItem`, três formas de
cobrança), mas não sabe **de onde vem o preço unitário**. Hoje `Material.preco` é um
número digitado à mão, sem memória de como foi obtido: não há custo, não há margem, e
subir o preço de uma família inteira significa editar um material por vez.

O catálogo levantado em `docs/precificacao/catalogo-materiais.csv` deixou isso concreto:
82 materiais distribuídos em 4 famílias, cada família com uma lógica de venda própria, e
nenhuma forma de dizer ao sistema qual é essa lógica.

O objetivo é um sistema de precificação **autônomo**: mesmo perdendo todos os dados, dá
para cadastrar tudo manualmente e o sistema volta a saber precificar sozinho.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| O que o sistema calcula sozinho | Venda a partir de custo e margem, por família |
| Quem escreve a fórmula | Fórmula fixa no código; os números são configuráveis na tela |
| Exceções à fórmula | O material pode travar o próprio preço e ignorar a família |
| Onde vivem os parâmetros | Entidade nova `FamiliaPreco` — `categoria` fica intocada |
| Escopo da tela | Simulador de impacto, histórico de preço, importador do CSV, origem do preço na ordem |

**Por que `FamiliaPreco` e não a `categoria`:** a categoria é texto livre e já tem outro
emprego — `irmasDeFamilia` (`src/domain/precificacao/resolucao.ts:163-169`) a usa para
oferecer as variações do material na tela da ordem. Pendurar precificação nela quebraria
esse uso, obrigaria a repetir a mesma configuração em ~20 categorias e exigiria migrar
`categoriasDeMateriais`. A família é um nível acima: são 4, e cada uma configura uma vez.

## A conta

Uma fórmula só, parametrizada. Ao detalhar as quatro famílias ficou claro que todas fazem
a mesma operação — o que muda são os números:

```
venda = arredondarPasso( custo × (1 + margem / 100), passo )
```

Exemplo verificado: custo R$ 38,00 com margem 120% → 38 × 2,20 = **R$ 83,60**.

Os extras que pareciam exigir fórmula própria — corte por metro linear na chapa, perda de
aproveitamento na bobina — **não entram na fórmula**. Viram acréscimo na ordem, usando o
`AcrescimoOrdem` que já existe. Quatro fórmulas quase idênticas seriam complexidade sem
uso; se um extra precisar entrar no preço do material depois, ele é adicionado então.

### O mínimo de cobrança

O mínimo é da família mas se aplica **no item da ordem**, não no preço do material: uma
peça de 0,4 m² numa família com mínimo de 1 m² é cobrada como 1 m².

Isso toca `calcularArea` (`src/domain/precificacao/formulas.ts:19-32`). A mudança é
aditiva: o input de cobrança ganha `minimoMedida?: Decimal` opcional e, quando ausente, o
comportamento é idêntico ao de hoje — nenhum teste existente muda de resultado.

## Modelo de dados

### `FamiliaPreco` (novo)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(uuid(7)) @db.Uuid` | como os demais models |
| `empresaId` | `String @db.Uuid` | + relação `Empresa` |
| `nome` | `String @db.VarChar(60)` | "Chapa rígida" |
| `unidadePadrao` | `UnidadeCobranca` | reusa o enum existente |
| `margem` | `Decimal @db.Decimal(6,2)` | 120.00 = +120% |
| `arredondamento` | `Decimal @db.Decimal(6,2)` | 0.01, 0.50 ou 1.00 |
| `minimoCobranca` | `Decimal? @db.Decimal(8,4)` | em m²/ml; `null` = sem mínimo |
| `ativo` | `Boolean @default(true)` | |

`@@unique([empresaId, nome])`, seguindo `Material`.

### `Material` (3 campos novos)

| Campo | Tipo | Nota |
|---|---|---|
| `custo` | `Decimal? @db.Decimal(12,4)` | `null` = não informado |
| `familiaPrecoId` | `String? @db.Uuid` | `null` = fora de qualquer família |
| `precoTravado` | `Boolean @default(false)` | ignora a família |

`preco` **permanece** e continua sendo a venda efetiva que a ordem lê. A mudança é só na
origem do número: quando `precoTravado = false` e há família e custo, ele é recalculado.

### `HistoricoPreco` (novo)

`materialId`, `de`, `para` (`Decimal(12,4)`), `motivo` (`VarChar(80)`), `usuarioId`,
`criadoEm`. Uma linha por mudança efetiva de preço, com o motivo dizendo o que causou:
`"margem da família"`, `"edição manual"`, `"importação"`.

## Domínio

Módulo novo `src/domain/precificacao/familia.ts`, puro e testável sem banco, como o resto
de `domain/precificacao`:

- `calcularVenda({ custo, margem, arredondamento }): Decimal`
- `arredondarPasso(valor, passo): Decimal` — generaliza `arredondarCentavos` de
  `dinheiro.ts` (passo 0,01 devolve exatamente o mesmo resultado)
- `precoEfetivo(material, familia)` — resolve os três casos: travado → `preco`; família e
  custo → calculado; qualquer outro → `preco` como está

Tudo em `Decimal` (decimal.js), nunca float, como manda `tipos.ts`.

## Fluxos

**Recalcular uma família.** Ao salvar novos parâmetros, todos os materiais da família com
`precoTravado = false` e `custo` não nulo têm `preco` recalculado, numa transação, com
uma linha de `HistoricoPreco` por material que mudou de valor. Materiais travados e
materiais sem custo são pulados, e a tela diz quantos foram pulados e por quê.

**Ordem já feita nunca muda.** `ItemOrdem.valorUnitario` e `total` são congelados na
gravação (`src/infra/ordens/repositorio.ts:203`); a ordem só lê `material.preco` ao montar
a linha. Recalcular 82 preços não altera histórico nenhum.

**Importar o catálogo.** `npm run catalogo:importar` lê o CSV, cria as 4 famílias com
parâmetros padrão e os 82 materiais. As 23 linhas com `status = a confirmar` entram
**inativas** — existem no catálogo mas ficam fora da entrada assistida até serem
confirmadas. Idempotente: rodar duas vezes não duplica (chave `[empresaId, nome]`).

## Telas

| Rota | Estado | O que faz |
|---|---|---|
| `/precificacao` | nova | Um cartão por família: margem, passo, mínimo, quantos materiais, faixa de custo → venda que produz |
| `/precificacao/[id]` | nova | Parâmetros + simulador de impacto; aplica só depois de mostrar hoje → ficaria |
| `/materiais` | evolui | Colunas de custo, venda e origem; cada célula leva a um destino diferente |
| `/materiais/[id]` | evolui | Custo, família e travar preço; mostra a conta ao vivo e o histórico |

**Destino de cada célula em `/materiais`** — é o que torna a tabela interativa:

| Célula | Vai para |
|---|---|
| Material | `/materiais/[id]` |
| Categoria | `/materiais?categoria=…` (filtra) |
| Custo | `/materiais/[id]?foco=custo` |
| Venda | `/materiais/[id]?foco=preco` |
| Origem | `/precificacao/[id]` da família |

Materiais de preço travado mostram cadeado na coluna de origem.

**Simulador.** Alterar a margem no formulário não salva nada: recalcula na hora a lista de
materiais afetados, lado a lado com o preço atual, e só o botão "Aplicar aos N" grava. É a
defesa contra uma vírgula errada virar 82 preços errados.

## Erros e casos de borda

| Caso | Comportamento |
|---|---|
| Família sem custo em nenhum material | Salva os parâmetros; avisa que 0 preços foram recalculados |
| Material com família mas sem custo | Fica com o `preco` digitado; a tela marca "custo não informado" |
| Material sem família nem custo | Funciona como hoje — preço digitado. Nada quebra |
| Travar um material | Congela o `preco` atual como ponto de partida |
| Destravar | Recalcula ao salvar — e o campo de preço já mostra o valor novo, em modo leitura, antes de confirmar. Ficou melhor que o "oferecer recalcular" previsto aqui: a pessoa vê o que vai acontecer em vez de decidir no escuro |
| Trocar o material de família | Recalcula esse material e registra no histórico |
| Excluir família com materiais | Bloqueado, como `excluirMaterial` faz com material em uso |
| Margem negativa | Permitida (venda abaixo do custo é decisão comercial); avisa mas não impede |
| Custo zero | Permitido — `validarComum` já aceita valor zero de propósito |
| `Decimal(12,4)` estourado | Recusa, reusando `cabeEmNumeric12x4` de `dinheiro.ts` |

## Testes

- **Unitários** (`familia.test.ts`, vitest): `calcularVenda` com margem 0/120/negativa;
  `arredondarPasso` nos três passos; `precoEfetivo` nos três casos; o mínimo de cobrança
  aplicado e não aplicado em `calcularArea`.
- **Integração** (`vitest.config.integration.ts`): recalcular família pula travados e sem
  custo; histórico grava uma linha por mudança efetiva; importador é idempotente.
- **E2E** (`@playwright/test`): configurar margem → simulador mostra o antes/depois →
  aplicar → a tabela reflete; clicar na célula de venda abre a edição com o campo em foco.
- **Visual**: validação com o ambiente local no ar e captura de tela em cada entrega.

## As três entregas — implementadas em 15/09/2026

1. **Fundação** — `prisma/migrations/20260915120000_precificacao_por_familia`,
   `src/domain/precificacao/familia.ts` (19 testes), `scripts/catalogo-importar.ts`.
2. **Tela de precificação** — `/precificacao` e `/precificacao/[id]` com o simulador.
3. **Tabela interativa** — `/materiais` com colunas e células navegáveis, histórico em
   `/materiais/[id]`, origem do preço e mínimo na linha da ordem.

### Três coisas que só apareceram ao construir

- **O mínimo de cobrança era um campo decorativo.** Estava configurável na tela e não
  chegava a `calcularItem`: a tela prometia um piso que a ordem não aplicava. Ligado em
  `minimoCobravel` (`src/infra/ordens/repositorio.ts`) e também na prévia da linha, senão
  o total mostrado divergiria do gravado.
- **Faltava criar família pela tela.** Só o importador criava, o que quebrava justamente o
  motivo do pedido — recomeçar sem os dados. `novaFamilia` e `excluir` fecham isso, e o
  botão de excluir some quando há material vinculado, em vez de recusar depois do clique.
- **O simulador ficava ilegível com o catálogo real.** Na Bobina são 3 materiais com custo
  contra 39 sem: listados juntos, as 39 linhas de "R$ 0,00 — sem custo" enterravam as 3
  que mudavam. As que entram na conta ficam na tabela; as outras, num bloco recolhido.

### Como foi verificado

446 testes unitários, 6 de integração no repositório de preço e 3 no mínimo da ordem,
`e2e/precificacao.spec.ts` com 6 casos, e validação visual no navegador com o ambiente
local no ar — incluindo o fluxo completo: custo → venda calculada → simulação → aplicação
→ histórico, e a linha da ordem mostrando "família Bobina" e "mínimo da família".

## Fora de escopo

Preço por faixa de quantidade, preço por cliente, fórmula editável pela tela, markup por
fornecedor e controle de estoque. `Material` continua sendo tabela de preço, não estoque —
sem quantidade, saldo ou movimentação, como diz a spec original na seção 4.
