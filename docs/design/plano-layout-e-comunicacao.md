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
| **Celular** | **Fora de escopo aqui** (decisão de 29/08). O sistema é usado no balcão e na bancada, em computador. Adaptar de verdade para celular é trabalho de branch e período próprios, tela por tela — ver **M1** no fim desta lista. Até lá, a verificação de cada item é feita em **1440px e 1280px**, nos dois temas. |

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
- [x] **F2. Troca de tema.** ✅ Feito. Três estados (Sistema, Claro, Escuro) no menu
  do usuário, com `aria-pressed` e marca de conferido. Cookie de um ano, sem
  `httpOnly` porque é o único que o navegador precisa ler. Escolha explícita vem
  pintada do servidor — conferido na resposta crua: com o cookie, o HTML já sai
  com `data-bs-theme="dark"` e sem script nenhum. "Sistema" é o único caso que usa
  um script síncrono antes da pintura, porque o servidor não tem como saber o tema
  do Windows de quem abriu; ele também escuta mudança do SO com a tela aberta.
  `suppressHydrationWarning` no `<html>` porque o script escreve o atributo antes
  da hidratação. Console limpo. Verificado que o impresso continua papel branco e
  tinta preta mesmo com o tema escuro ligado.
- [x] **F3. Camada de componentes.** ✅ Feito. Sete componentes em
  `src/componentes/`: `CabecalhoPagina`, `CorpoPagina`, `CartaoTabela`,
  `EstadoVazio`, `FiltroPeriodo`, `Dinheiro` (+ `valorEmReais`) e `NumeroOs`.
  Convertidas como prova `/financeiro`, `/materiais` e `/usuarios`.

  Decisões que ficam valendo para as conversões seguintes:
  - `CartaoTabela` exige `rotulo` (o `aria-label`) — não dá para esquecer.
    `/materiais` ganhou um que não tinha.
  - Ações do cabeçalho usam `gap-2`, aposentando o `me-2` de algumas telas.
  - `Dinheiro` devolve **só o texto**, de propósito: `.numero` alinha à direita e
    `text-align` num `<span>` inline não alinha nada. A classe continua no `<td>`
    ou na `<div>`. Embrulhar em span teria perdido em silêncio o alinhamento de
    todas as colunas de dinheiro — pego na conversão e conferido depois no
    navegador (50 células em `/financeiro`, nenhuma desalinhada).
  - `FiltroPeriodo` usa `col-6 col-md-3` nas datas: no celular elas ficam lado a
    lado em vez de empilhadas.

  **As outras 19 telas são convertidas no item T de cada uma** — a conversão faz
  parte do trabalho da tela, não de um mutirão à parte.
- [x] **F4. Cor e rótulo semântico num lugar só.** ✅ Feito. `src/componentes/selo.tsx`
  passa a ser o único lugar que decide cor de significado: cinco tons (`neutro`,
  `marca`, `bom`, `atencao`, `ruim`) e um mapa por eixo do domínio. Apagados os
  sete mapas espalhados, inclusive o `COR_PAGAMENTO` que estava duplicado byte a
  byte, e as quatro decisões que eram ternário dentro do JSX. Treze pontos de
  chamada convertidos. `SeloApelido` encerra o mesmo fragmento repetido em seis
  telas. Teste fixa o significado: se alguém trocar "não pago" para verde, quebra.

  **Contraste dos selos, medido no navegador nos dois temas** (composição do alfa
  feita pelo próprio navegador num canvas, sem interpretar texto de cor):

  | Selo | Claro antes | Claro depois | Escuro depois |
  |---|---|---|---|
  | marca | 4,24:1 ❌ | **5,90:1** | 6,53:1 |
  | bom (`Serviço finalizado`, `Pago`) | 2,49:1 ❌ | **9,65:1** | 6,97:1 |
  | ruim (`Não pago`, `Cancelada`) | 4,04:1 ❌ | **11,88:1** | 5,43:1 |
  | atenção (`Parcial`) | — | 8,61:1 | 7,85:1 |
  | neutro | — | 12,05:1 | 5,33:1 |

  A correção é uma linha por cor no `tema.css`: o texto do selo passa a vir da cor
  de ênfase em vez da cor cheia. O Tabler pintava texto e fundo com a mesma cor, e
  por isso o contraste nunca abria.

  `text-orange` da fila de produção (única ocorrência no app inteiro) virou o
  token semântico `text-warning`. "Esta semana" fica sem cor própria de propósito:
  se tudo tem cor, nada tem.

  Fora de escopo, para a T8: os limiares coloridos dos indicadores em `/operacao`
  ainda são ternário inline.

- [x] **F5. Fim dos formatadores paralelos.** ✅ Feito. Apagada a implementação por
  expressão regular do painel de pagamento e os cinco atalhos `R$` redeclarados
  por tela; `valorEmReais` é agora o único caminho. Os três `padStart(6,'0')`
  viraram `formatarNumeroOs`/`NumeroOs`. Imports órfãos removidos.

  O teste guarda os dois lados: para os valores que a tela realmente recebe (o
  repositório sempre entrega com duas casas) a saída é **idêntica** à de antes; e
  onde o formatador aposentado errava, o teste registra o erro — ele escrevia
  `R$ 80` para `80`, `R$ 80,5` para `80.5`, e `R$ 1.234,567` para `1234.567`,
  porque não arredondava. Ou seja: a troca é correção, não regressão.

  Conferido no navegador: 121 valores em seis telas, todos no formato
  `R$ 1.234,56`, nenhum fora do padrão. Saldo e preço final inalterados.

- [x] **F6. Texto padronizado.** ✅ Feito.
  - **Botão gravando:** cinco versões viraram uma (`SALVANDO`). Havia
    "Gravando…", "Salvando…", "Criando…", "…" (só as reticências, sem dizer nada)
    e um botão que não mudava. "Entrando…" no login fica: entrar não é gravar.
  - **Conflito de trava otimista:** três redações viraram `CONFLITO_ORDEM`. A quarta
    (`… Recarregando…`) continua separada porque é outro caso: a tela já recarrega
    sozinha e não há o que a pessoa fazer.
  - **Papel do usuário:** cinco cópias viraram `ROTULO_PAPEL` e `DESCRICAO_PAPEL`.
  - **Gênero fixo:** "você mesma não pode se desativar" virou "você não pode
    desativar o seu próprio acesso".
  - **Porcentagem:** `emPercentual` traduz o "75.2" canônico do domínio para
    "75,2%". Conferido no navegador: **zero** porcentagens com ponto em
    `/operacao` e `/clientes/carteira`. A guarda contra string vazia importa:
    `Number('')` é zero, e sem ela um campo vazio viraria "0,0%" — um número
    inventado, pior que não mostrar nada.
  - **Mensagens sem acento:** 15 corrigidas em `formulas.ts`, `ordem.ts` e
    `ordens/repositorio.ts` — "preco final nao pode ser negativo" chegava assim
    na tela. Três testes de domínio e um de integração acompanharam o texto novo.

### Casca

- [x] **C1. Menu lateral agrupado.** ✅ Feito. Cinco grupos (Atendimento, Produção,
  Financeiro, Arquivo, Configuração) com "Fila de trabalho" no topo, fora de
  grupo. As três telas escondidas entraram: Carteira de clientes, Relatório do
  contador e Plano de contas. O nome no menu virou o título da tela — "Financeiro"
  virou "Livro-caixa", "Operação" virou "Indicadores" (a página também).

  O item ativo acende com `aria-current="page"` e o trilho esquerdo que o Tabler
  já desenhava e estava sem uso desde sempre. Regra: **vence o endereço mais
  longo**, senão `/clientes/carteira` acenderia "Clientes" e `/financeiro/contador`
  acenderia "Livro-caixa". Cada grupo é uma lista com nome próprio
  (`aria-labelledby`), e grupo sem item visível não desenha cabeçalho.

  **Desvio do combinado:** "Nova saída" **não** entrou no menu, ao contrário do que
  a descrição da opção prometia. É uma ação, não um lugar; continua sendo o botão
  da tela do livro-caixa, que é de onde ela faz sentido. O esboço que você
  escolheu também não a mostrava.

  **Buraco encontrado e fechado:** quem é da operação entra e cai em `/`, mas o
  item apontava para `/producao` — então **nada acendia** e a pessoa não sabia onde
  estava. `navegacaoPara` corrige o destino por papel, com teste.

  **Dívida que a C2 paga:** com os cabeçalhos de grupo a lateral em 390px passou de
  532px para **823px** de menu antes do conteúdo. Piorou de propósito, porque a C2
  (menu em `offcanvas`) tira a lateral do fluxo e o número deixa de existir.

- [x] **C2. Celular.** ✅ Feito. A lateral existe em duas formas: fixa em telas
  largas, gaveta (`offcanvas`) em telas estreitas, com barra de topo e botão. A
  gaveta fecha sozinha quando a pessoa escolhe um item — senão ela navega e
  continua olhando para o menu.

  **O número que resume:** em 390px o conteúdo começava em **823px** (todo o menu
  empilhado acima, sem como fechar) e agora começa em **80px**.

  Medido em 390px, 768px e 1440px, nos dois temas:
  - **zero** rolagem horizontal da página em qualquer largura;
  - o que ultrapassa a tela está **todo** dentro do `.table-responsive`, que rola
    sozinho — nenhum elemento fora de um rolador próprio;
  - a troca é limpa: até 768px barra de topo e sem lateral (margem 0), em 1440px
    lateral e sem barra (margem 240px).

  O botão "Nova ordem" e o total do cartão, que a vistoria pegou cortados na
  borda, cabem inteiros agora.

- [x] **C3. Estrutura da página.** ✅ Feito. O conteúdo virou `<main id="conteudo">`
  de verdade — antes os únicos marcos da página eram a barra lateral e o menu, e
  o conteúdo não era nada. O título de cada tela virou `<h1>` (eram todos `h2`) e o
  título de cartão subiu de `h3` para `h2`. **Nenhuma mudança visual**: `.page-title`
  e `.card-title` já fixam o próprio tamanho no Tabler, então a tag não decide nada
  de aparência.

  Link "Pular para o conteúdo" como primeiro elemento focável: invisível até o
  primeiro Tab, quando aparece como botão no canto. Sem ele, quem navega por
  teclado atravessava os 13 links do menu **em toda tela**. Verificado de ponta a
  ponta: Tab foca o link, Enter leva o foco para `MAIN#conteudo`.

  Conferido em 17 telas: exatamente **1 `<h1>`, 1 `<main>` e nenhum salto de
  nível** em cada uma, mais o impresso.

  **Dois buracos que a verificação pegou:**
  - `/producao` ficou sem `h1` porque o `className` era `"page-title fs-1"` e minha
    busca exigia a aspa logo após `page-title`. Só apareceu porque medi todas as
    telas em vez de conferir uma.
  - URL inexistente caía no 404 padrão do Next, **sem `<main>` e sem a nossa cara**:
    o `not-found` que existia só responde a `notFound()` dentro do app. Criado
    `src/app/not-found.tsx`, que traz a própria casca e não consulta o banco — nesse
    ponto nem sabemos se há alguém logado.

- [x] **C4. Estados de carregamento.** ✅ Feito. Um `loading.tsx` para o app
  inteiro, com o contorno do que vai chegar (cabeçalho, filtro e a tabela dentro
  do cartão) em vez de roda-roda no meio da tela. `role="status"` com "Carregando…"
  para leitor de tela, e as barras marcadas `aria-hidden` para não serem lidas
  como conteúdo.

  **Comecei errado e o teste corrigiu.** Escrevi cinco `loading.tsx` por rota, com
  formatos próprios (cartões para produção, indicadores para `/operacao`). Ao tentar
  fotografar, descobri que **nenhum deles chegava a ser desenhado**:

  - no carregamento de uma URL, o layout do grupo também é assíncrono (lê sessão e
    tema), então o limite do grupo é o primeiro a ficar pendente e é o dele que
    aparece — provado: `/operacao` mostrava o esqueleto genérico, com botão de
    ação que o dela nem pedia;
  - na navegação pelo menu, o Next já pré-carregou a rota e **não há espera nenhuma**.

  Os cinco arquivos foram apagados em vez de ficarem como enfeite. Cartão+tabela
  é a forma de 11 das 14 telas, então o genérico não mente na maioria.

  Medido com a rede estrangulada: o esqueleto fica em cena de **1,2s a 3,5s** no
  histórico, que é a espera mais longa do sistema, e some quando o conteúdo chega.

- [x] **C5. Dois avisos do console.** ✅ Feito. Console e rede **limpos**: nem o 404
  do favicon, nem o aviso do Next sobre rolagem suave.

  `data-scroll-behavior="smooth"` no `<html>`: o Tabler põe `scroll-behavior:
  smooth`, e sem o atributo a troca de rota desliza até o topo em vez de começar
  nele.

  Ícone da aba em `src/app/icon.svg`: monograma "D" em círculo, **como a marca já
  está descrita** em `design/prompt-claude-design.md` ("ciano #5FC4D8, monograma D
  dentro de um círculo, geometria firme, alto contraste"). O "D" é caminho vetorial
  e não texto, porque fonte em favicon não se garante e em 16px a letra tem de ser
  a mesma em qualquer máquina. Conferido em 16, 32 e 96px sobre fundo claro e
  escuro: a aba do navegador não segue o tema do sistema, então precisa funcionar
  nos dois.

  **É provisório e está escrito dentro do arquivo:** é o desenho da marca conforme
  descrita, não o arquivo oficial. Quando a logo de verdade existir (ela entra
  junto com o anexo de arte), trocar o arquivo.

  **Erro que a verificação pegou:** escrevi `--` dentro de um comentário XML, o que
  é ilegal. O arquivo baixava com 200 e content-type certo, mas o navegador não
  conseguia interpretá-lo como imagem — as seis amostras vinham quebradas. Só
  apareceu porque fui olhar o ícone renderizado em vez de confiar no 200.

### Telas

Ordem por tráfego e por gravidade do que foi encontrado.

- [x] **T1. `/producao` — Fila de produção.** ✅ Feito. Era a pior tela da vistoria.

  **A altura caiu de 13.045px para 1.383px.** Cada grupo virou uma seção que abre
  e fecha: os com prazo nascem abertos, e "Sem data combinada" (87 ordens) nasce
  fechado, com a contagem à vista. Aquilo não é fila: é pendência de combinar
  prazo, e ocupava 90% da tela.

  Na hierarquia do cartão: o **item lançado virou o maior bloco** — é o que a
  bancada precisa ler para trabalhar, e estava em letra miúda com marcador,
  **depois** do nome do cliente. A data aparece uma vez, não duas ("Entrega 4 de
  setembro" + "04/09/2026" era a mesma informação repetida). Três cartões por
  linha em tela larga, contra dois.

  **Defeito grave encontrado ao medir, que não estava na vistoria:** o botão verde
  "Serviço finalizado" — o que a produção aperta o dia inteiro, de pé e às vezes
  contra a luz da bancada — estava em **2,63:1**, muito abaixo dos 4,5:1 que texto
  de botão exige. O verde do Tabler (#2FB344) com texto branco simplesmente não
  dá. Trocado por #1A7F37: **4,86:1**, medido. De quebra resolve metade da queixa
  de "cem botões verdes": um verde escuro lê como ação, o neon lía como alarme.

  O `style={{ minHeight: 56 }}` do botão virou a classe `.botao-producao` — um dos
  quatro estilos inline que a vistoria apontou.

  **Ressalva honesta:** nas capturas o verde ainda pesa bastante no cartão, porque
  **todas as ordens de teste estão sem item lançado** e o corpo do cartão fica
  quase vazio. Com item de verdade, o bloco de trabalho ocupa o espaço e o botão
  passa a ser o rodapé que ele é. Vale reconferir com dados reais.

- [x] **T2. `/ordens` — lista.** ✅ Feito.

  **Paginação de verdade**, 50 por página: "Mostrando 1 a 50 de 148", "Página 1 de
  3". São links, sem JavaScript — a página entra no endereço, então o botão voltar
  do navegador funciona e dá para guardar o link. Verificado que o filtro
  sobrevive: `/ordens?estado=aberta&pagina=2` mostra 51 a 100 de 100. A altura caiu
  de 4.769px para 2.583px. O componente `Paginacao` fica pronto para `/historico`
  e `/clientes`.

  **O confete de selos acabou:** era um selo de Situação **e** um de Pagamento em
  cada linha, dois pastéis lado a lado que não davam para varrer. Agora é **um selo
  por linha**. Situação continua selo, porque é o ciclo da ordem; pagamento virou
  texto e só se colore quando pede atenção — "Pago" fica cinza discreto, "Não pago"
  vermelho, e no parcial o que aparece é **quanto falta**, que é a informação útil.
  O olho agora vai direto para o que deve dinheiro.

  Contraste medido dos textos novos: vermelho **13,72:1** claro / 5,76:1 escuro;
  âmbar **9,32:1** / 9,23:1. Usei as versões `-emphasis` de propósito: o vermelho
  cheio dá 4,04:1 e reprovaria.

  Na consulta, `contarOrdens` ficou separado de `listarOrdens` porque os testes de
  integração dependem daquela devolver um array. As duas compartilham a mesma
  função de filtro: se divergirem, a paginação mente.

  **Desvio do plano:** não fiz a **linha inteira clicável**. Fazer isso exige ou um
  `onClick` por linha (que quebra seleção de texto e clique do meio para abrir em
  outra aba) ou uma sobreposição de link (que engole a seleção do mesmo jeito).
  Copiar o nome de um cliente da tabela é coisa que se faz. Em vez disso o **nome
  do cliente virou link também**, que é um alvo bem maior que o número.

- [x] **T3. `/ordens/[id]` — a mais densa.** ✅ Feito. A coluna da direita passou a
  ler na ordem certa: **quanto custa** primeiro, **o que fazer** depois.

  - **Preço final subiu para a primeira dobra:** estava em y≈866 (fora da tela em
    900px, e ainda por baixo do selo do Next), agora em **y=209**. Medido.
  - **Um botão primário, não dois.** "Concluir e receber" é a ação; "Ajustar preço"
    é correção administrativa e virou botão comum. Conferido: sobrou um só
    `btn-primary` no conteúdo.
  - **"Preço final" com dois sentidos a 60px de distância:** o total (que se lê) e
    o campo do ajuste (que se escreve). O formulário de ajuste virou uma seção
    dobrada, "Ajustar o preço", aberta só quando já existe ajuste, e o campo passou
    a se chamar "Novo preço final".
  - **Estado virou selo**, igual ao resto do sistema. Era texto cinza em maiúsculas
    aqui e selo colorido na lista: a mesma informação com duas caras.
  - **A página não pula mais no carregamento.** O `autoFocus` do campo de item
    rolava até 783px sozinho, de forma intermitente. Trocado por foco com
    `preventScroll`: o cursor ainda vai para o campo, a tela fica quieta. Medido:
    rolagem 0 no carregamento.
  - **Placeholder do cliente não é mais cortado** ("… vazio é venda de balc"): o
    texto encurtou e a explicação desceu para a dica do campo.
  - **Combobox completo:** o campo ganhou `role="combobox"`, `aria-expanded`,
    `aria-controls` e `aria-autocomplete`. Antes a lista se anunciava como
    `listbox` mas nada dizia que o campo a controlava.
  - O `style={{ zIndex: 10 }}` da lista virou classe — mais um dos quatro estilos
    inline que a vistoria apontou (restam dois, ambos `whiteSpace: pre-line`).

- [x] **T4. `/` — Fila de trabalho.** ✅ Feito.

  - **Os dois cartões deixaram de ficar lado a lado.** Um vazio e curto, o outro
    com catorze linhas: sobrava meia tela em branco à esquerda. Empilhados, cada
    um tem a altura que precisa (251px e 722px) e as tabelas ganharam a largura
    inteira — **"Venda de balcão" parou de quebrar em duas linhas**, que era o que
    inchava as catorze linhas.
  - **A busca cabia a tela toda**: 1170px de campo para digitar seis dígitos. Agora
    561px. Continua sendo a ação principal, só que com tamanho de campo.
  - Estado vazio passou a usar o mesmo tratamento do resto do sistema.

  **Duas coisas que a conversão obrigou a arrumar nos componentes:**
  - `CartaoTabela` ganhou `vazio`: um cartão com cabeçalho próprio não pode
    embrulhar outro cartão só para dizer que está vazio. `EstadoVazio` foi
    dividido em `BlocoVazio` (o miolo) e o embrulho.
  - `CartaoTabela` ainda gerava `h3` no título do cartão. A C3 trocou os arquivos
    de tela e **esqueceu o componente**; só não apareceu na verificação porque
    nenhuma tela convertida até então passava `titulo`. Corrigido para `h2`.
    Conferido nesta tela: H1 H2 H2, sem salto.

- [x] **T5. `/historico`.** ✅ Feito. **De 18.854px para 5.407px.** Duas causas, e a
  segunda era a maior.

  1. **Sem paginação:** despejava até 100 linhas de uma vez. Agora 50 por página,
     369 páginas, e a busca sobrevive ao virar: `?q=placa&pagina=2` mostra 51 a 100
     de 4.538. A soma e a contagem continuam sendo do **filtro inteiro**, não da
     página — R$ 5.654.432,03 nas 18.443.
  2. **As linhas de ponto solitário.** Cada linha da tabela tinha ~190px, e quase
     tudo era ponto. As ordens antigas guardavam a descrição em sete campos,
     `OBS1..OBS7`, e campo sem uso não ficava em branco: ficava com um ponto. Ao
     juntar os sete numa coluna, cada ordem virava duas linhas de conteúdo e cinco
     de pontos. Agora a linha tem **100px** e há **zero** pontos soltos na tela.

     Isto é só exibição, nada muda no banco. E é **mais** fiel, não menos: ponto
     solitário não é o que a pessoa digitou, é como o banco antigo marcava "aqui
     não tem nada". Mesmo assim o subtítulo da tela foi reescrito para dizer
     exatamente o que faz, em vez de prometer "o texto exatamente como foi
     digitado". Função pura com teste, em `texto-legado.ts`.

  Junto: "18443" virou "18.443", o comando de terminal saiu do estado vazio, e o
  `style={{ whiteSpace: 'pre-line' }}` virou classe.

- [x] **T6. As quatro telas de cliente.** ✅ Feito.

  - **Paginação de verdade.** A tela dizia "Mostrando os primeiros 50. Refine a
    busca." e não havia como ver o resto — os outros 1.203 clientes eram
    inalcançáveis pela lista. Agora são 26 páginas, com o filtro preservado.
  - **"Novo cliente" e "Cadastrar cliente"** eram a mesma ação com dois nomes, na
    mesma tela. Agora é um nome só.
  - **Pretítulo consistente.** Era "Atendimento", "Clientes" e "Cliente" (singular)
    entre as quatro. **Regra que passa a valer:** o pretítulo nomeia o pai na
    navegação — o grupo da barra lateral quando a tela é o próprio item de menu,
    e o item de menu quando a tela está abaixo dele. Daí `/clientes` →
    "Atendimento" e as três filhas → "Clientes".
  - A busca deixou de ocupar a largura toda, como na tela inicial.
  - O texto do legado na ficha passou a usar a mesma limpeza da T5, e o `<h4>` de
    "Observações" virou `h3` — pulava nível depois do `h2` do cartão.
  - Sumiram os dois últimos `style={{ whiteSpace: 'pre-line' }}`: **os quatro
    estilos inline que a vistoria apontou acabaram.**

  **Fica registrado, sem conserto:** durante a verificação apareceram **dois avisos
  de hidratação** nas rotas `[id]` e `editar`, logo depois de eu editar esses
  arquivos. **Não reproduzem:** 24 navegações seguintes, com e sem troca de tema,
  deram console limpo. A explicação mais provável é recompilação do servidor de
  desenvolvimento no meio da hidratação. Vale reconferir na passada final (Z1) com
  o servidor já aquecido; se voltar, é defeito de verdade.

  **Não mexido de propósito:** o `toLocaleDateString` da ficha, único do app. Ele
  escolhe UTC para cliente vindo do legado e São Paulo para cadastro novo, e essa
  diferença é real — trocar por um formatador único mudaria a data mostrada.

- [x] **T7. `/clientes/carteira`.** ✅ Feito.

  - **A fileira de indicadores estava desalinhada** porque o primeiro cartão não
    tinha legenda e os outros três tinham: a altura vinha do conteúdo. Extraí
    `CartaoIndicador`, que resolve isso com `h-100`. Medido: os quatro com
    **117px exatos**. O primeiro também ganhou legenda — um número sem
    explicação ao lado de três que têm é estranho por si só.
  - **"Para reativar" sumia da tela** quando não havia ninguém adormecido, e
    sobrava meia tela em branco. Agora o cartão fica e explica: sem ele a pessoa
    não sabia se a lista não existia ou se estava vazia.
  - `0.0%` virou `0,0%` — zero porcentagens com ponto na tela.

  O `CartaoIndicador` já nasce servindo a T8 (`/operacao`, seis indicadores com
  cor por limiar) e a T9 (`/financeiro`, três totais), que hoje desenham o mesmo
  bloco à mão e nenhuma igual.

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

- [ ] **Z0. Registro das mensagens de validação.** Sobraram ~25 mensagens de
  `ErroDeValidacao` corretas em português mas escritas em registro de
  desenvolvedor: minúsculas e sem ponto final ("aprove o orçamento antes de
  receber", "a ordem já está paga"). Elas chegam verbatim na tela, ao lado de
  texto escrito com maiúscula e ponto.
  **Armadilha encontrada na F6, por isso isto virou item separado:** várias são
  compostas em frases maiores (`{erro} — mostrando o mês atual.`). Se a mensagem
  ganhar ponto final, a frase composta fica "Data inválida. — mostrando o mês
  atual." Cada uma precisa ser decidida junto com o lugar onde aparece; não é
  varredura mecânica.
- [ ] **Z1. Passada final.** Percorrer as 22 telas nos dois temas em 1440px e 1280px.
  Conferir contraste de todo par texto/fundo. Navegar o sistema inteiro só pelo
  teclado. Rodar `npm run check` e `npm run e2e`. Escrever o que ficou de fora.

---

## Como cada volta termina

Uma volta só está pronta quando:

1. `npm run typecheck` passa;
2. `npm test` passa (e ganhou teste novo se a mudança mexeu em cálculo ou formato);
3. a tela foi aberta no navegador **nos dois temas**, em **1440px e 1280px**, e
   conferida por captura (celular não entra: ver M1);
4. o texto visível foi lido em voz de quem usa: Odete no balcão, não desenvolvedor;
5. existe um commit só daquele item, com mensagem que diz o que a pessoa ganha.

## O que não muda

O motor de preço, a máquina de estados, as transações e o schema. Este trabalho é
de casca. Se alguma melhoria de layout exigir mudar regra de negócio, ela para e
vira conversa.

---

## Adiado para branch própria

- [ ] **M1. Adaptar o sistema para celular, tela por tela.** Decisão do Otavio em
  29/08: o sistema é usado em computador, no balcão e na bancada. Fazer celular
  "de passagem", junto com outra coisa, entrega meio-termo em 22 telas. Merece
  branch e período próprios.

  **O que a C2 já deixou pronto e não precisa ser refeito:** a lateral vira gaveta
  abaixo de 992px, o conteúdo começa em 80px em vez de 823px, e nenhuma tela tem
  rolagem horizontal. Ou seja, o sistema **abre e navega** no celular. O que falta
  é cada tela ser pensada para a tela pequena, e não apenas caber nela:

  - tabelas de 7 colunas que hoje viram rolagem lateral (ordens, financeiro,
    histórico) provavelmente devem virar cartões;
  - `/ordens/[id]`, que tem duas colunas e cinco painéis, precisa de uma ordem de
    leitura própria no estreito;
  - a fila de produção é a candidata mais forte a uso real em celular, na bancada;
  - alvos de toque, teclado numérico nos campos de valor, e a foto do anexo de
    arte quando a Fase 6 destravar.
