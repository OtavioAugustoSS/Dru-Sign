# Plano — layout e comunicação

Branch: `design/comunicacao-e-layout`.
Achados que originam este plano: [vistoria-2026-08-29.md](./vistoria-2026-08-29.md).

## Contexto

As seis fases da spec estão implementadas e o sistema funciona, mas a interface
cresceu tela a tela, sem camada comum: 20 cópias do cabeçalho de página, três
tratamentos de estado vazio, quatro formatadores de dinheiro, cor semântica
espalhada por sete arquivos. O resultado é um sistema que funciona e não comunica:
a fila de produção tem 13.045px de altura e ~100 botões verdes idênticos, o celular
mostra 490px de menu antes da primeira linha útil, e o preço final da ordem — o
número mais importante do negócio — fica fora da primeira dobra.

O objetivo não é deixar bonito. É que a Odete no balcão e a produção na bancada
achem o que procuram sem procurar.

## Decisões já tomadas (não relitigar)

| Assunto | Decisão |
|---|---|
| Profundidade | Camada própria de tokens e componentes **sobre** o Tabler. O Tabler continua sendo a base técnica; o app deixa de repetir JSX. Não trocar de framework de UI. |
| Modo escuro | Segue o sistema operacional por padrão, com botão no menu do usuário para forçar claro ou escuro. Escolha gravada em cookie, por usuário. Sem piscar branco no carregamento. |
| Menu lateral | Agrupado por fluxo de trabalho (ver abaixo). |
| Ritmo do trabalho | Uma tela por volta do `/loop`, com verificação e commit próprios. |

### Menu lateral — estrutura acordada

```
DruSign                          [buscar]

  ▸ Fila de trabalho              (topo, fora de grupo)

  ATENDIMENTO
    Ordens
    Clientes
    Carteira de clientes          ← hoje escondida atrás de um botão

  PRODUÇÃO
    Fila de produção

  FINANCEIRO
    Livro-caixa                   ← o menu dizia "Financeiro"
    Relatório do contador         ← hoje escondida atrás de um botão
    Plano de contas

  ARQUIVO
    Histórico (até 2026)

  CONFIGURAÇÃO
    Materiais e preços
    Indicadores                   ← o menu dizia "Operação"
    Usuários
    Dados da empresa
```

O nome do item no menu passa a ser igual ao título da página. Quem é da operação
continua vendo só o que lhe cabe (Fila de produção, Ordens, Histórico), agora sob
os cabeçalhos de grupo.

### Cor — as duas faces

| Papel | Claro | Escuro | Contraste |
|---|---|---|---|
| Primária | `#0E7C93` | `#5FC4D8` (ciano da logo) | 4,86:1 no branco · 8,76:1 no `#111827` |
| Texto sobre a primária | `#ffffff` | `#111827` | — |
| Fundo, superfície, borda | do Tabler | do Tabler (`data-bs-theme=dark`) | já validados pelo Tabler |

O ciano da logo foi proibido como cor de botão no claro porque tem 2,02:1 sobre
branco. No escuro ele dá 8,76:1 e vira a cor certa. A marca finalmente aparece
inteira em algum lugar.

Todo token de marca hoje declarado num `:root` incondicional em `src/app/tema.css`
precisa ganhar par no escuro — em especial `--tblr-primary-lt`,
`--tblr-primary-bg-subtle`, `--tblr-primary-border-subtle` e
`--tblr-primary-text-emphasis`, que hoje são hexes claros fixos e carregam os selos
de seis telas.

`src/app/(impresso)/impresso.css` **fica fora do tema escuro**. É tinta em papel.

---

## Fila de trabalho

Cada item é uma volta do `/loop`: uma tela ou um assunto, verificado e commitado
sozinho. Marcar `[x]` só depois do commit.

### Fundação — precisa vir antes de tudo

- [x] **F1. Tokens de tema, claro e escuro.** ✅ Feito. `tema.css` com os 17 tokens
  de marca pareados; a primária vira `#5FC4D8` no escuro (8,76:1 contra os 3,65:1
  que a teal daria). Corrigido de quebra o selo primário, que estava em 4,24:1 no
  claro — abaixo do mínimo — e foi para 5,90:1 apontando o texto para a cor de
  ênfase. `viewport` com `colorScheme` e `themeColor` no layout raiz: sem isso o
  campo de data nativo ficava branco no meio da tela escura.
  Conferido no navegador nos dois temas, 1440px e 390px.
- [ ] **F2. Troca de tema.** Cookie por usuário, leitura no servidor para pintar o
  `<html data-bs-theme>` já na primeira resposta (sem piscar), opção "Sistema" que
  segue o SO, e o controle no menu do usuário. Marcar a preferência com
  `aria-pressed` ou equivalente.
- [ ] **F3. Camada de componentes.** Criar em `src/componentes/`:
  `CabecalhoPagina` (título, pretítulo opcional, ações, e a variante com subtítulo),
  `CorpoPagina`, `CartaoTabela`, `EstadoVazio` (um só tratamento, aposentando os
  outros dois), `FiltroPeriodo`, `Dinheiro`, `NumeroOs`. Converter **todas** as 22
  telas para eles nas voltas seguintes; nesta volta, criar e converter três telas
  como prova.
- [ ] **F4. Cor e rótulo semântico num lugar só.** Um módulo que mapeia estado de
  produção, estado de pagamento, urgência, recência, tipo de lançamento e tipo de
  conta para selo e cor. Apagar os sete mapas espalhados, inclusive o
  `COR_PAGAMENTO` duplicado.

  **Medido no navegador durante a F1 — os selos semânticos reprovam contraste, e
  isso já é verdade hoje, sem tema escuro nenhum:**

  | Selo | Claro | Escuro |
  |---|---|---|
  | `bg-success-lt` ("Serviço finalizado", "Pago") | **2,49:1 reprova** | 4,60:1 OK |
  | `bg-danger-lt` ("Não pago", "Cancelada") | 4,04:1 só texto grande | **2,95:1 reprova** |

  O Tabler pinta o texto do selo com a cor cheia e o fundo com a mesma cor a 10%
  de alfa, então os dois andam juntos e o contraste nunca abre. A F1 resolveu
  exatamente isso para a primária (4,24:1 → 5,90:1) trocando o texto pela cor de
  ênfase em `.bg-primary-lt`. **Aplicar o mesmo padrão a success, danger, warning
  e secondary, nos dois temas, é trabalho desta tarefa** — e é o que torna a lista
  de ordens varrível, não só bonita.
- [ ] **F5. Fim dos formatadores paralelos.** Apagar a implementação por regex em
  `painel-pagamento.tsx:27` e o atalho `R$` redeclarado nos seis arquivos; usar
  `formatarMoeda` em todos. Trocar os três `padStart(6,'0')` por `formatarNumeroOs`.
  **Escrever teste** provando que os valores do painel de pagamento não mudaram.
- [ ] **F6. Texto padronizado.** Um rótulo de botão pendente para todo o app; uma
  frase de conflito otimista (hoje são quatro); rótulo de papel vindo de um lugar
  só (hoje são cinco). Corrigir "você mesma não pode se desativar" para forma
  neutra. Trocar `75.2%` por `75,2%` em toda porcentagem — é vírgula em português.

  **Mais grave, achado depois:** as mensagens de `ErroDeValidacao` do domínio e da
  infra chegam **verbatim** na tela (as actions fazem `return { ok: false, erro:
  e.message }`), mas foram escritas em registro de desenvolvedor: minúsculas, sem
  ponto final e **várias sem acento** — "descreva o item", "o motivo do ajuste e
  obrigatorio", "preco final nao pode ser negativo", "responsavel nao encontrado",
  "data prometida invalida" (`src/infra/ordens/repositorio.ts`), "altura e largura
  sao obrigatorias para cobranca por m2"
  (`src/domain/precificacao/formulas.ts`), "aprove o orçamento antes de receber",
  "a ordem já está paga", "conta não encontrada". Contrastam com o texto escrito
  direto nas telas, que é maiúsculo inicial e pontuado ("O nome é obrigatório.").
  A Odete lê as duas coisas no mesmo lugar. Reescrever todas sem mexer no
  comportamento, com teste que fixe as novas mensagens.

### Casca

- [ ] **C1. Menu lateral agrupado**, com o item ativo marcado (`usePathname` +
  `aria-current="page"`; o Tabler já tem o estilo pronto e sem uso) e as três telas
  hoje escondidas trazidas para o menu.
- [ ] **C2. Celular.** Menu em `offcanvas` com botão de abrir, cabeçalhos de página
  que não vazam da tela em 390px, e tabelas que não espremem valor em duas linhas.
  Conferir em 390px, 768px e 1440px.
- [ ] **C3. Estrutura da página.** `<main>` de verdade, um `<h1>` por tela, e link
  de pular para o conteúdo — hoje são 11 links de menu antes do conteúdo em toda
  navegação por teclado.
- [ ] **C4. Estados de carregamento.** `loading.tsx` nas rotas que consultam o
  banco, com esqueleto no formato do conteúdo, não roda-roda no meio da tela.
- [ ] **C5. Dois avisos do console.** `/favicon.ico` dá 404 em toda página: o
  sistema não tem ícone nenhum na aba do navegador. E o Next avisa que o Tabler põe
  `scroll-behavior: smooth` no `<html>`, o que atrapalha a troca de rota — resolver
  com `data-scroll-behavior="smooth"` no `<html>`.

### Telas

Ordem por tráfego e por gravidade do que foi encontrado.

- [ ] **T1. `/producao` — Fila de produção.** A pior da vistoria: 13.045px, ~100
  cartões idênticos, o botão verde maior que o número da OS. Inverter a hierarquia
  (número e prazo primeiro, ação depois), tirar a data repetida em dois formatos,
  paginar ou limitar por grupo, e fazer o item lançado aparecer — é o que a bancada
  precisa ler. O verde deixa de ser o padrão e passa a marcar só o que é urgente.
- [ ] **T2. `/ordens[/…]` — lista.** Paginação de verdade. Resolver o confete de
  dois selos pastel por linha. Linha inteira clicável.
- [ ] **T3. `/ordens/[id]` — a mais densa.** Subir o preço final para a primeira
  dobra. Desempatar os dois botões primários: "Concluir e receber" é a ação,
  "Ajustar preço" não. Resolver "Preço final" com dois sentidos a 60px de distância.
  Mostrar estado como selo, igual ao resto do sistema. Corrigir o placeholder
  cortado do campo cliente. Completar o combobox (`role`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`).
- [ ] **T4. `/` — Fila de trabalho.** Os dois cartões de altura desigual, o campo de
  busca superdimensionado, e "Venda de balcão" repetido 14 vezes em coluna.
- [ ] **T5. `/historico`.** 18.854px sem paginação, na tela cujo propósito é buscar.
- [ ] **T6. `/clientes` + `/clientes/[id]` + `/clientes/novo` + editar.** Paginar
  (hoje diz "Mostrando os primeiros 50" sem controle nenhum). Unificar
  "Novo cliente" e "Cadastrar cliente". Acertar o pretítulo entre as quatro telas.
- [ ] **T7. `/clientes/carteira`.** Alinhar a fileira de indicadores (o primeiro
  cartão não tem legenda e desalinha os quatro). Resolver a meia tela vazia quando
  não há adormecidos. Corrigir `0.0%`.
- [ ] **T8. `/operacao` → Indicadores.** Tirar título e número da mesma linha.
  Aplicar cor de alerta a todo indicador fora do alvo, não só ao primeiro.
  Corrigir `75.2%` e `82.4%`. Resolver "0 dias" no prazo de entrega.
- [ ] **T9. `/financeiro` + `/financeiro/saida` + `/financeiro/contador`.** Alinhar
  o título com o menu ("Livro-caixa" nos dois). Tirar "Ver o livro-caixa" de dentro
  do cartão de filtro.
- [ ] **T10. `/materiais` + `/materiais/[id]`.** O `…` como rótulo de botão
  pendente. O estado vazio mais longo do app, sem ação, com o formulário logo acima.
- [ ] **T11. `/plano-de-contas`.** 3.493px. Aspas retas no meio do português. O
  padrão de caixa de seleção com botão "Atualizar" que não existe em nenhuma outra
  tela.
- [ ] **T12. `/usuarios` + `/empresa`.** O link de texto "Imprimir" apontando para
  `/ordens`. O formulário de criação sem cabeçalho, diferente de `/materiais`.
- [ ] **T13. `/entrar`, `error.tsx`, `not-found.tsx`.** As três telas sem casca.
  Conferir que funcionam nos dois temas.
- [ ] **T14. `/ordens/[id]/impresso`.** Conferir que o tema escuro **não** vaza para
  o papel, e que a impressão continua saindo igual.

### Fechamento

- [ ] **Z1. Passada final.** Percorrer as 22 telas nos dois temas em 390px e 1440px.
  Conferir contraste de todo par texto/fundo. Navegar o sistema inteiro só pelo
  teclado. Rodar `npm run check` e `npm run e2e`. Escrever o que ficou de fora.

---

## Como cada volta termina

Uma volta só está pronta quando:

1. `npm run typecheck` passa;
2. `npm test` passa (e ganhou teste novo se a mudança mexeu em cálculo ou formato);
3. a tela foi aberta no navegador **nos dois temas** e conferida por captura;
4. o texto visível foi lido em voz de quem usa: Odete no balcão, não desenvolvedor;
5. existe um commit só daquele item, com mensagem que diz o que a pessoa ganha.

## O que não muda

O motor de preço, a máquina de estados, as transações e o schema. Este trabalho é
de casca. Se alguma melhoria de layout exigir mudar regra de negócio, ela para e
vira conversa.
