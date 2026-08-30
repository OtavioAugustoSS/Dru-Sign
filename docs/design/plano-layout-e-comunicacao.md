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

- [x] **T8. `/operacao` → Indicadores.** ✅ Feito. A tela que o dono abre para julgar
  o próprio negócio passa a dizer o que está ruim.

  - **Quatro dos seis indicadores agora se colorem contra o alvo**, contra dois
    antes. O que ficava preto neutro incluía **"valor parado em ordens não
    cobradas"** — o número que mais dói neste negócio, e o que motivou trocar de
    sistema. Agora três números vermelhos dizem o problema de relance.
  - **O valor desceu para debaixo do próprio rótulo.** Estava alinhado à direita
    (`.numero`), longe do nome que ele mede; agora divide a margem esquerda com
    ele. Nova classe `.digitos`: largura fixa de dígito **sem** forçar alinhamento
    à direita, que é o que coluna de tabela quer e cartão de indicador não.
  - **"0 dias" virou "no mesmo dia"**, no valor e na nota. Tecnicamente igual;
    "0 dias" parecia campo vazio ou conta que deu errado.

  **Corrigido no caminho, e valia para o sistema todo:** `TEXTO` mapeava para
  `text-success` e `text-danger` cheios. Verde cheio dá **2,74:1** sobre branco.
  Como eu ia colorir quatro números grandes, troquei pelos `-emphasis`: medido
  **13,72:1** no claro e 5,76:1 no escuro. A fila de produção herda a correção.

  **Sobre os avisos de hidratação (ver T6):** aconteceu de novo, e agora tem
  assinatura clara. **Só no primeiro carregamento depois de editar a rota**; com o
  servidor aquecido, **seis carregamentos seguidos deram zero**. Duas ocorrências
  independentes, mesmo padrão. É recompilação do servidor de desenvolvimento, não
  defeito do app — mas confirmar na Z1 com `npm run build`, que não tem
  recompilação.

  **Não uniformizei a altura das duas fileiras** de cartões (99px e 117px): dentro
  de cada fileira eles se alinham, que é o que importa. Forçar as seis à altura da
  maior só acrescentaria espaço vazio.

- [x] **T9. `/financeiro` + `/financeiro/saida` + `/financeiro/contador`.** ✅ Feito.

  - **Título alinhado com o menu:** ambos dizem "Livro-caixa". O pretítulo seguiu a
    regra da T6 — `/financeiro` e `/financeiro/contador` são itens de menu, então
    levam o grupo ("Financeiro"); `/financeiro/saida` é filha do livro-caixa e leva
    "Livro-caixa".
  - **"Ver o livro-caixa" saiu de dentro do cartão de filtro**, onde estava junto
    dos campos de data: navegação no meio de um formulário. Foi para o cabeçalho,
    ao lado de "Baixar CSV". Conferido: zero links dentro do filtro.
  - Os três totais do livro-caixa e o saldo do relatório viraram `CartaoIndicador`,
    e **o saldo passou a se colorir** — verde quando entra mais do que sai,
    vermelho quando não. Era o único dos quatro números que quer dizer bom ou ruim.
  - A nota sobre estorno saiu de um parágrafo solto no fim da página e foi para
    dentro do cartão do saldo, que é o número que ela explica.

  **Não paginei o livro-caixa, de propósito.** O período já é o limite: a tela abre
  no mês atual, e os totais de entrada, saída e saldo têm de cobrir o período
  inteiro de qualquer forma. Paginar um livro-caixa que se lê para conferir o mês
  atrapalharia em vez de ajudar.

- [x] **T10. `/materiais` + `/materiais/[id]`.** ✅ Feito.

  - **O estado vazio mais longo do app** tinha cinco frases, uma delas apontando
    para o formulário que está logo acima, visível. Sobraram duas: o que o catálogo
    **é** (tabela de preço, não estoque) e que **dá para trabalhar sem ele**. As duas
    coisas que a pessoa não sabe.
  - O `…` como rótulo de botão pendente já tinha caído na F6. Conferido: nenhuma
    reticência solta na tela.
  - A primeira opção do select era `escolha…`, minúscula e fora da família das
    outras telas ("Escolha a forma", "Escolha a conta", "Escolha o papel").
  - Pretítulo pela regra da T6: a lista leva "Configuração" (grupo), a edição leva
    "Materiais e preços" (item de menu pai). Antes a lista dizia "Administração",
    que não é grupo nenhum do menu novo.

  **Errei e a captura mostrou:** troquei `escolha…` por "Escolha como é cobrado", e
  na tela apareceu **"Escolha como é"**, cortado — texto longo demais para a
  coluna. Ficou "Escolha", que mede 50px num campo de 167px.

- [x] **T11. `/plano-de-contas`.** ✅ Feito.

  - **Aspas retas no meio do português** viraram curvas: `"Usar para recebimentos"`
    → `“Usar para recebimentos”`. Aspa reta é marca de código, não de citação.
    (Não dá para ver na captura: o aviso só aparece quando nenhuma conta recebe as
    vendas, e no banco de desenvolvimento há uma.)
  - **O botão "Atualizar" em estilo de link** não existia igual em nenhuma outra
    tela. As telas com filtro dizem "Mostrar" e usam botão de verdade; esta passa a
    dizer o mesmo.
  - `onChange={undefined}` na caixa de seleção, dentro de um Server Component, era
    ruído sem efeito. Saíu.
  - Comando de terminal fora do estado vazio; pretítulo "Administração" →
    "Financeiro", que é o grupo real no menu novo.

  **A altura ficou em 3.469px e não mexi nisso de propósito.** Diferente da fila de
  produção, aqui a altura vem do conteúdo — 48 contas em 6 grupos — e não de
  moldura repetida. É lista de referência, que se varre com o olho; dobrar os
  grupos esconderia justamente o que se veio ver.

- [x] **T12. `/usuarios` + `/empresa`.** ✅ Feito.

  - **O link mentia:** dizia "Imprimir" e levava para a lista de ordens. O texto
    prometia uma ação e o destino era outro lugar. Agora o link diz "Ordens", que
    é para onde vai, e a instrução de imprimir ficou em palavras.
  - **O formulário de criar usuário não tinha cabeçalho**, diferente de Materiais e
    do Plano de contas: aparecia solto no topo sem dizer o que cria. Ganhou
    "Novo usuário".
  - Pretítulo das duas: "Administração" → "Configuração", o grupo real do menu.

  **Achado na captura, fora do que o plano previa:** CNPJ, os dois telefones e o
  CEP estavam **alinhados à direita** dentro do campo, porque usavam a classe das
  colunas de dinheiro. Identificador se lê e se digita da esquerda — o cursor
  começava no canto errado. Trocados pela classe `.digitos`, que dá largura fixa de
  dígito sem forçar alinhamento. Campo de dinheiro continua à direita, que é onde
  faz sentido: é assim que as casas decimais se alinham.

- [x] **T13. `/entrar`, `error.tsx`, `not-found.tsx`.** As três telas sem casca.
  Conferir que funcionam nos dois temas.

  Medido nas quatro telas (a `not-found` são duas: a da raiz, sem menu, e a de
  dentro da casca) em claro e escuro, 1440px e 1280px. Os dois temas passam:
  título 9,86 no claro e 14,33 no escuro, explicação 4,63 e 6,99, botão 8,76.
  Um H1 por tela, nada cortado, nada em cor fixa no código.

  Dois defeitos que só apareceram ao ver a tela renderizada, nenhum deles na
  vistoria:

  - A tela de erro tinha **uma ação só**, "Tentar de novo". Erro permanente
    (endereço inválido, registro de outra empresa) não passa por tentar de
    novo: a pessoa fica batendo no mesmo botão. Ganhou "Fila de trabalho".
  - O texto dizia "o que você digitou não foi salvo" mesmo quando ninguém
    estava digitando — este limite pega falha de leitura também. Reescrito.
    O código do erro saiu da frase para uma linha própria, e some quando não
    existe, em vez de escrever "sem código".

  Um terceiro, achado na mesma captura e que valia para o sistema todo: dentro
  do `container-xl` a explicação do estado vazio saía numa **linha única de mil
  pixels**. `.empty-subtitle` ganhou limite de medida (56ch, centrada) no
  `tema.css`; agora quebra em duas ou três linhas curtas, como já acontecia na
  tela de endereço errado, que usa `container-tight`. Vale para os estados
  vazios dentro de cartão também: medidos em 480–520px depois da mudança.

  Nada a mudar no `/entrar`: a marca "DruSign" acima e o título "Entrar" no
  cartão são papéis diferentes (identidade e tarefa), e a palavra repetida no
  botão é o rótulo da ação. Nenhum dos dois confunde.

  O 404 da raiz **não aparece para quem não está logado**: `/rota-inexistente`
  redireciona para `/entrar?proximo=…` antes de chegar nele. Quem vê é quem já
  entrou. O erro no console nessa tela é o próprio HTTP 404 da resposta, não
  um defeito.
- [x] **T14. `/ordens/[id]/impresso`.** Conferir que o tema escuro **não** vaza para
  o papel, e que a impressão continua saindo igual.

  **Vazava.** Quem usa o tema escuro imprimia com 40% da folha em preto. A folha
  em si sempre foi branca com tinta preta (o `impresso.css` usa cor fixa, não
  variável de tema), mas na impressão a `.impresso-raiz` perde o
  `min-height: 100vh` e encolhe até a altura do conteúdo — o que sobra da folha
  passa a ser o fundo do `body`, que no escuro é `#121212`. Medido pixel a pixel
  na captura em `media: print`: **525.600 dos 1.296.000 pixeis da página**, tudo
  abaixo de y=535. `html, body { background: #fff }` no bloco de impressão. Depois
  da correção, as duas folhas — tema claro e tema escuro — têm **zero pixel de
  diferença**.

  Dois outros achados, ambos na barra de ações acima da folha, nenhum na vistoria:

  - Os três botões são do Bootstrap e seguiam o tema escuro: ficavam escuros
    sobre a mesa cinza-clara da folha, e o de "vias" media **2,14:1** no escuro
    (4,08 no claro — reprovava nos dois). O layout do impresso passa a fixar
    `data-bs-theme="light"`, o que alinha os botões ao papel numa linha só, em
    vez de corrigir cada botão. Agora: 10,31 / 6,76 / 10,31, iguais nos dois temas.
  - O botão de vias era um **link de mão única** escrito "2 vias". Depois de
    clicar, continuava apontando para `?vias=2`: não havia volta para uma via só,
    e o rótulo não dizia em qual dos dois estados a folha estava. Agora alterna, e
    o rótulo diz o que o clique faz — "Incluir a via da loja" / "Tirar a via da
    loja" — nas mesmas palavras impressas no alto de cada via.

  O e2e `impresso.spec.ts` não usa o rótulo do botão (navega direto para
  `?vias=2`), então segue valendo sem mudança.

### Fechamento

- [x] **Z0. Registro das mensagens de validação.** Sobraram ~25 mensagens de
  `ErroDeValidacao` corretas em português mas escritas em registro de
  desenvolvedor: minúsculas e sem ponto final ("aprove o orçamento antes de
  receber", "a ordem já está paga"). Elas chegam verbatim na tela, ao lado de
  texto escrito com maiúscula e ponto.
  **Armadilha encontrada na F6, por isso isto virou item separado:** várias são
  compostas em frases maiores (`{erro} — mostrando o mês atual.`). Se a mensagem
  ganhar ponto final, a frase composta fica "Data inválida. — mostrando o mês
  atual." Cada uma precisa ser decidida junto com o lugar onde aparece; não é
  varredura mecânica.

  **61 mensagens reescritas.** A armadilha era real e a saída foi mexer nos dois
  lados: a mensagem ganha ponto final *e* a frase composta perde o travessão, que
  agora sobraria. As cinco composições ficaram assim:

  | Onde | Antes | Agora |
  |---|---|---|
  | Livro-caixa, contador | `período inválido — mostrando o mês atual.` | `Período inválido. Mostrando o mês atual.` |
  | Indicadores | `período inválido — mostrando tudo.` | `Período inválido. Mostrando tudo.` |
  | Histórico | `período inválido — ignorando o período.` | `Período inválido. Mostrando sem filtro de data.` |
  | Entrada assistida | `descreva o item Enter para tentar de novo.` | `Descreva o item. Enter para tentar de novo.` |

  No histórico, "ignorando o período" dizia o que o sistema deixou de fazer;
  "Mostrando sem filtro de data" diz o que a pessoa está vendo. A da entrada
  assistida já era duas frases coladas sem ponto — consertou-se sozinha.

  Nem toda mudança foi de caixa. Estas viraram outra frase: "tipo precisa ser
  receita ou despesa" → "Escolha se a conta é de receita ou de despesa";
  "login: 2 a 64 letras, números, ponto, hífen ou sublinhado, sem espaço" →
  "O login aceita de 2 a 64 letras…"; "esta é a única administração ativa;
  promova outra pessoa antes" → duas frases; "defina no plano de contas a conta
  que recebe as vendas" → "Nenhuma conta recebe as vendas. Escolha no plano de
  contas…", que repete as palavras do aviso já existente naquela tela.

  Duas ficaram deliberadamente de fora: as do importador do sistema antigo
  (`domain/legado/ordem.ts`), que só chegam ao terminal de quem roda o script —
  confirmado, o único chamador é `scripts/importar-ordens.ts`.

  **Um defeito de contraste apareceu junto**, ao medir a mensagem renderizada, e
  vale para o sistema inteiro: `.text-danger` dá **4,66:1 no claro** (no limite)
  e **3,15:1 no escuro** (reprova). As 26 ocorrências passaram a
  `.text-danger-emphasis`. Só que o valor de fábrica dele no claro é `#561717`,
  marrom quase preto: passa com 13,72:1 e **deixa de ler como erro** — a mensagem
  sumia dentro do formulário como se fosse uma nota. Então a cor de texto do
  vermelho passou a ser declarada no `tema.css`, como já era a primária:
  `#B42318` no claro, `#F87171` no escuro. Medido nas quatro superfícies:

  | Superfície | Claro | Escuro |
  |---|---|---|
  | Mensagem sobre o cartão | 6,57 | 5,31 |
  | Selo "Cancelada" (`.bg-danger-lt`) | 5,69 | 5,00 |
  | Botão "Cancelar ordem" | 6,57 | 5,31 |

  A marcação de atraso na fila de produção usa o mesmo token, mas não havia ordem
  atrasada no banco para medir na tela.

  Nos testes: os que checavam **qual** regra disparou usavam fragmento em regex
  sensível a caixa (`/aprove o orçamento/`) e passaram a `/i` — a caixa da
  primeira palavra não é o que eles testam. Os que afirmavam a frase inteira
  foram atualizados. 385 testes passando.
- [x] **Z1. Passada final.** Percorrer as 22 telas nos dois temas em 1440px e 1280px.
  Conferir contraste de todo par texto/fundo. Navegar o sistema inteiro só pelo
  teclado. Rodar `npm run check` e `npm run e2e`. Escrever o que ficou de fora.

  ### A varredura visual

  21 telas × 2 temas × 2 larguras, medindo **toda assinatura única** de
  texto/fundo — não uma amostra: para cada elemento com texto próprio, a cor
  composta contra a pilha inteira de fundos, com o mínimo de 4,5:1 ou 3:1
  conforme tamanho e peso. Controles desabilitados ficam de fora (WCAG 1.4.3 os
  isenta — é o caso do "Anterior" da paginação na primeira página, 2,09:1 de
  propósito).

  Quatro defeitos. Três eram controles que vêm com **cor fixa escrita por cima
  dos tokens do Tabler**, servindo a mesma cor nos dois temas:

  | Controle | Cor | Claro | Escuro |
  |---|---|---|---|
  | `.btn-link` | `#077CEA` | 4,13 | 3,55 |
  | `.btn-ghost-danger` | `#D63939` | — | 3,15 |
  | `.input-group-text` (o "R$") | `#6B7280` | — | 3,67 |

  O `.btn-link` era o pior: além de reprovar, era **azul do Bootstrap num sistema
  cuja primária é azul-petróleo**. "Cancelar", "Só receber", "Voltar à ordem" — as
  ações secundárias do sistema inteiro estavam fora da marca.

  O quarto: a ficha da ordem pulava de h1 para h3 no cartão de pagamento.

  Depois das correções, a varredura fecha **limpa**: contraste, um h1 por tela,
  sem pulo de nível, sem rolagem horizontal.

  ### O teclado

  O pior defeito de toda a vistoria, e o único que só aparece navegando:
  **nada no sistema mostrava onde o foco estava.** Botão primário, botão comum,
  botão fantasma, campo, link — todos com `outline: none` e só a sombra de
  repouso. Não era um controle esquecido: era o sistema inteiro (WCAG 2.4.7).

  O Bootstrap zera o outline em `.btn:focus-visible` e `.form-control:focus`,
  que são (0,2,0) — um `button:focus-visible` (0,1,1) perdia. Casando a
  especificidade, o anel passa a valer: 2px na primária, com 2px de afastamento,
  então o que contrasta é o anel contra o **fundo da página**, não contra o
  botão: 4,73:1 no claro e 8,76:1 no escuro. Conferido tabulando 42 paradas nos
  dois temas: **zero sem anel**.

  Uma coisa que parecia defeito e não é: o Tab não começa no "Pular para o
  conteúdo" na maioria das telas. É o `autoFocus` do campo de busca, que põe o
  cursor onde a Odete vai digitar — e alcança o mesmo que o link de pular, mais
  direto. Shift+Tab ainda leva ao menu.

  ### `npm run check`

  `typecheck` e os **385 testes de unidade** passam. O `test:int` fecha 80 de 81.

  Sete falhas eram mensagens que o commit `40423a6` acentuou sem atualizar os
  testes de integração — invisíveis porque **`test:int` não entra no `npm test`**,
  que é o portão de cada volta do loop. Corrigidas.

  Sobra uma: a importação das 18.443 ordens legadas estoura os 300s. Não é deste
  trabalho (nada aqui toca importador, schema ou transação) e não é o teto de
  conexões do PGlite — testei com e sem `DATABASE_POOL_MAX=2` e estoura igual. É
  o PGlite local sendo lento para carga em massa. **Fica para o Otavio decidir:**
  subir o `testTimeout` desse teste ou marcá-lo como lento.

  ### `npm run e2e`

  **32 de 32.** Começou em 22 de 32: o e2e não era rodado a cada volta (o
  Playwright derruba o `next dev` no fim), então dez testes ficaram para trás
  enquanto a casca mudava. Nove eram testes desatualizados; um apontava defeito
  de verdade.

  O padrão mais interessante: `getByLabel` casa com o `<label>` **e** com o
  `aria-label` de qualquer elemento. As tabelas ganharam `aria-label` nesta
  reforma, e "Materiais e preços" passou a casar com `getByLabel('Preço')` junto
  com o campo. O rótulo da tabela é bom e fica; a busca é que estava imprecisa —
  daí o helper `campoDe`, que pede rótulo **e** ser controle de formulário.

  O defeito real: a fila de produção não tinha título nenhum abaixo do h1 — quem
  usa leitor de tela via ~100 cartões sem nada separando "Atrasadas" de "Hoje".
  Os nomes dos grupos viraram h2 dentro do `summary`, com diff de pixel zero.

  ### O aviso de hidratação

  Era recompilação do dev, como suspeitado. `npm run build` e o servidor de
  produção: **zero mensagens no console** em 40 carregamentos (20 rotas × 2
  temas).

  ### O que ficou de fora

  - **Celular** — item M1, branch própria, decisão do Otavio.
  - **A importação das 18.443 no `test:int`** — acima.
  - **`design/` e `docs/superpowers/specs/`** seguem sem versionar, esperando
    decisão.
  - **O `icon.svg`** continua marcado PROVISÓRIO: é um monograma, não a marca.

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

---

## Depois do plano — o que o Otavio pediu ao rever tela por tela

O plano fechou; estas mudanças vieram da revisão dele, olhando o sistema rodando.
Ficam registradas aqui porque **desfazem decisões escritas acima**, e um plano que
descreve o que o código não faz mais engana quem ler depois.

### A barra lateral: buracos e a linha do perfil torta

Três defeitos, todos da mesma família — a sobra de altura ia para o lugar errado.

`.navbar-nav` do Tabler vem com `flex-grow: 1`, e a lateral é uma coluna flex.
A sobra de altura era **repartida** entre a lista do topo e o bloco do perfil:
medido a 1080px de janela, **144px de vazio em cada um**. Era o buraco embaixo de
"Fila de trabalho" e a faixa morta no rodapé. E, com a sobra toda consumida pelo
`flex-grow`, o `mt-auto` do perfil não tinha folga para empurrar nada: ele colava
no último item do menu e se lia como se fosse mais uma entrada.

A linha do perfil estava torta: o `p-0` no botão tirava o recuo de 1rem que todo
item da lateral tem, e o Tabler centraliza o conteúdo do `.nav-item` — o avatar
caía em **x=47** contra os **x=16** dos ícones. Agora ícone, rótulo de grupo e
avatar começam todos na mesma coluna.

E numa janela baixa a barra **vazava para fora da tela** em vez de rolar. Conferido
a 1080, 900, 768 e 700px: a navegação rola por dentro, marca e perfil ficam parados.

### O selo colorido sai do sistema

**Isto desfaz a C4 e parte da T2.** O selo era um retângulo arredondado com fundo
tingido, um por linha. Numa lista onde doze de cada dezoito linhas dizem "Aberta",
160 retângulos coloridos fazem a coluna gritar — e como a largura acompanha a
palavra, a borda direita da coluna fica serrilhada.

Havia **dois usos diferentes dentro do mesmo componente**, e era essa a raiz:

| O que é | Antes | Agora |
|---|---|---|
| Situação de um registro (estado, pagamento, recência, tipo) | selo tingido | ponto de 8px na cor do estado + palavra na cor do corpo |
| Qualificação colada a um nome (apelido, "arquivado", "você") | selo tingido | aparte em texto menor e secundário, com `·` do CSS |

A cor continua sendo o atalho de quem varre a coluna; a palavra continua sendo a
resposta de quem lê. E o texto ganhou o contraste do corpo (10,31 no claro, 11,86
no escuro) em vez do contraste de um texto tingido.

Junto caiu a decisão do `Pagamento` em texto colorido: ela existia porque "dois
selos pastel lado a lado viravam confete". Sem o selo, a razão caiu — e o texto
colorido tinha virado o novo grito, com "Não pago" em vermelho e negrito em quase
toda linha, já que ordem aberta normalmente ainda não foi paga.

**Uma observação para o Otavio decidir:** mesmo em ponto, "Não pago" aparece em
vermelho em ~90% das linhas, porque é o estado normal de uma ordem aberta. O sinal
que interessa neste negócio é outro: **serviço finalizado E não pago** — os
R$ 207.795 parados que motivaram trocar o sistema. Dá para o vermelho marcar só
esse caso, e o "não pago" de ordem aberta ficar neutro. Não fiz porque muda o que
uma cor *significa* no sistema, e essa é decisão sua.

---

## Fila aberta — pedidos da revisão tela por tela

O que o Otavio pediu e ainda não foi feito. Ordem de cima para baixo é a que eu
proponho; ele decide.

### F1. Números no alto de cada tela de lista
Cartões com o que aquela tela conta, **clicáveis**, levando à lista já filtrada.
Feito em `/clientes` (cadastros ativos, cadastrados aqui, do sistema antigo,
arquivados). Falta: ordens, livro-caixa, produção, materiais, usuários,
histórico.

### F2. Uma tela de painel
Todos os números do sistema num lugar só, cada um levando para a tela que o
detalha. Convive com a F1 em vez de substituí-la: a F1 serve quem já está na
tela, o painel serve quem está começando o dia. **A "Fila de trabalho" hoje já é
metade disso** — a decisão é se ela vira o painel ou se nasce uma tela ao lado.

### F3. Toda grade com o mesmo tratamento
Paginação, filtro e ordenação em todas as tabelas, do mesmo jeito. Hoje varia:
`/ordens` e `/clientes` têm cartão de filtro e paginação; `/materiais`,
`/usuarios` e `/plano-de-contas` não têm nem uma coisa nem outra. Ordenação por
coluna não existe em lugar nenhum.

### F4. Separar o legado do que nasce aqui
Ideia do Otavio: os dados vindos do sistema antigo não devem se misturar aos
novos quando entrar em produção — arquivados, não apagados. **Primeiro passo já
existe:** `/clientes` filtra por origem do cadastro, e a ficha do cliente separa
"Ordens" de "No sistema antigo". As ordens antigas já vivem noutra tabela
(`OrdemLegado`) e noutra tela (`/historico`).

O que falta é decidir o que "arquivado" quer dizer para os **clientes** do
legado, e aí a decisão é de negócio, não de layout:

| Opção | O que acontece |
|---|---|
| Nada | 1.241 cadastros do legado seguem na busca do balcão, junto dos novos |
| Arquivar todos | Somem da busca do dia a dia; reaparecem com "Incluir arquivados" ou quando alguém volta a comprar |
| Arquivar os sem compra recente | Só os que não aparecem há X anos saem da frente |

Hoje **1.978 dos 3.238 já estão arquivados** e 1.241 do legado seguem ativos.

### F5. Materiais e preços
O Otavio vai mandar as precificações. Os 18 materiais que existem hoje são todos
artefato de teste do e2e e saem antes.

### F6. Limpeza dos dados de teste
Ensaio feito, **zero referências presas**: 12 usuários "Fulano de Teste", 18
materiais e 19 clientes com "e2e" no nome. O script `scripts/_limpar.ts` está
pronto; falta o Otavio autorizar a execução.

Sobram ainda **252 ordens** no sistema, todas criadas em desenvolvimento e no
e2e. Não apaguei porque são elas que dão conteúdo às telas que ele está
revisando. Antes de produção, saem.

### F7. O material casa por UMA palavra só — e isso muda o preço

Achado percorrendo o fluxo. `acharMaterial` pontua por sobreposição de palavras
entre o que foi digitado e o nome do material, e **não exige mínimo**: uma
palavra em comum já vincula.

Com "ACM 3MM BRANCO" no catálogo, a linha da OS 18449 —
`12 PLACAS ACM 61 X 40 E ADES/ IMP 61,00` — casou por causa do "ACM" sozinho. E
casar não é inofensivo: o material **decide a unidade de cobrança**. A linha, que
é por unidade, virou por m². O preço digitado ainda venceu (o catálogo só entra
quando não há valor na linha), mas se não houvesse preço digitado, o valor viria
de um material que não é aquele.

Foi assim que três testes de ponta a ponta quebraram, e eles estavam certos.

**A decidir com o Otavio, porque é regra de negócio:**

| Opção | Efeito |
|---|---|
| Exigir 2+ palavras em comum | "ACM" sozinho deixa de casar; "ACM BRANCO" casa |
| Exigir uma fração do nome do material | "ACM" contra "ACM 3MM BRANCO" é 1 de 3 — não casa |
| Casar só o que a pessoa confirma | O sistema sugere, a pessoa aceita; nunca vincula sozinho |

O catálogo está vazio hoje, então o problema não aparece. Ele aparece no dia em
que as precificações entrarem — e aí aparece em toda ordem.
