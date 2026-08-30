# Sistema de gestão DruSign — especificação

**Data:** 27 de agosto de 2026
**Autor:** Otavio Augusto, com análise assistida
**Status:** aguardando revisão

---

## 1. Contexto e problema

A **DruSign Placas e Comunicação Visual** fabrica placas, adesivos, banners, fachadas e
sinalização em Unaí, Minas Gerais. Cerca de 700 ordens de serviço por ano, ticket mediano
de R$ 316, faturamento anual em torno de R$ 500 mil.

A empresa opera sobre o **OSGRAFICA 4.5A**, um sistema de ordem de serviço licenciado em
2010 da Virtual Programas Ltda (marca FpqSystem, Porto Alegre). Ele roda em Clipper /
xHarbour sobre arquivos DBF, em um compartilhamento de rede.

### O que a engenharia reversa mostrou

A análise de 52 tabelas e 65.395 registros, cobrindo 18.443 ordens de maio de 2012 a
agosto de 2026, estabeleceu três fatos que definem este projeto.

**O sistema não foi feito para uma gráfica.** Nasceu como ordem de serviço para
assistência técnica de informática e recebeu uma camada de gráfica por cima em 2012, sem
que nada fosse removido. As condições impressas na OS até hoje falam em *"garantia de 90
dias para mão de obra e peças usadas no conserto"* e em *"aparelhos não retirados no prazo
de 30 dias"* — texto de 2007, nunca alterado. Consequência: **27 dos 76 campos da tabela
de ordens estão em 0,00% de preenchimento**, e os campos criados para descrever o serviço
(`SERVICO1` a `SERVICO4`) nunca receberam um único valor.

**O que a empresa vende não está em campo estruturado.** Está datilografado em `OBS1` a
`OBS7`, sete linhas de texto livre de 130 caracteres, preenchidas em 91% das ordens.
Quantidade, dimensão, preço unitário e total vão todos numa string, e a soma é feita na
calculadora antes de ser digitada num campo único. O legado **tinha** uma tela de itens
estruturados — a tabela `ORDEM2` — e ela foi abandonada em oito meses: cobre 579 de 18.443
ordens (3,1%) e 1,77% do faturamento histórico, com 765 das 772 linhas datadas de 2012.

**O sistema parou de gravar direito em abril de 2025.** A taxa de ordens que nunca chegam
a ser finalizadas saltou de 3,4% em 2024 para 20,4% em 2025 e 28,2% em 2026. O ponto de
inflexão é preciso: 9,4% em março de 2025, 43,8% em maio. Na mesma janela a empresa mudou
de endereço e houve mudança na rede — confirmado pelos donos. O executável roda de
`Z:\backup grafica rapida\backup\OSGRAFICA4.5A\`, e o `Error.log` de 26/08/2026 registra
`DOS Error 59` (erro inesperado de rede) dentro da rotina `GRAVA_ORDEM`, no clique de
salvar a ordem.

**O custo disso está medido: R$ 207.795 parados em 513 ordens abertas**, sendo
R$ 166.120 apenas de 2025 e 2026.

### O que este sistema resolve

Substituir o núcleo do legado por um sistema que grava de forma transacional, mostra o que
está pendente, e permite que mais de uma pessoa opere. Hoje apenas a Odete usa o sistema —
não por escolha, mas porque ele está quebrado e ela é a única obrigada a conviver com ele.

---

## 2. Escopo da v1

A v1 **substitui** o núcleo do legado. Não convive com ele. A Odete desliga o sistema
antigo no dia em que o novo entrar.

**Dentro:** ordem de serviço com itens estruturados, impresso da OS, conclusão,
recebimento, livro-caixa, cadastro de clientes, catálogo de materiais com preços,
administração com indicadores, e fila de produção.

**Por que substituição e não convivência.** A alternativa considerada — mover só a OS e
deixar o financeiro no legado — quebraria a única coisa que o sistema antigo faz bem: a
cadeia OS → título → caixa, que bate centavo a centavo em 99,2% dos 14.651 títulos. Isso
produziria digitação dupla, e digitação dupla é como se garante que ninguém adota.

**Orçamento é estado da ordem, não módulo separado.** É como o legado já modela
(`ORCAMENTO` é uma flag dentro de `ORDEM`), e é como o negócio funciona. Aprovar não recria
nada: muda o estado e trava o preço. Registro: a flag foi usada em 14 de 18.443 ordens —
o orçamento hoje é feito numa pasta do Windows, fora do sistema.

---

## 3. Usuários e papéis

| Papel | Quem | Como usa |
|---|---|---|
| **Atendimento** | Odete | 8h por dia, no balcão. Executora em 84,6% das ordens de 2024–2026 |
| **Produção** | funcionário | De pé, olhando de longe. Vê a fila e marca serviço finalizado |
| **Administração** | Otavio, Pedro | Eventual. Configuração, financeiro, indicadores |

**Dois papéis no sistema:** administração e operação. Não mais.

O legado tem 65 flags de permissão por usuário e os três usuários vivos têm todas ligadas.
Ele também tem 10 usuários cadastrados, **7 marcados como apagados** — a ambição
multiusuário já existiu e morreu junto com o sistema.

**Critério de design:** aprendibilidade acima de densidade. Alguém contratado precisa
conseguir usar sem treinamento longo. Um usuário só hoje é sintoma, não requisito.

---

## 4. Modelo de domínio

Todas as tabelas carregam `empresa_id` desde o início, mesmo com um único cliente hoje.
Adicionar depois é retrabalho em cada consulta.

Dinheiro sempre em `Decimal` (Prisma) mapeado para `numeric(12,4)`. Ponto flutuante em
nenhum lugar.

**Nada de `DELETE`.** Cliente vira arquivado; ordem cancelada preserva todos os campos.
O legado destruiu o nome do cliente em 3.152 ordens (17,1% da base) e apagou 1.978
cadastros que carregam R$ 1,34 milhão de histórico.

### Entidades

**Empresa** — razão social, CNPJ, endereço, telefone, logo. É o que sai no cabeçalho do
impresso.

**Usuario** — nome, login, senha (Argon2), papel (`administracao` | `operacao`), ativo.

**Cliente** — nome, apelido, documento (CPF/CNPJ, opcional), telefones, email, endereço,
arquivado_em, atualizado_em.
Cliente é **plano**, agrupado por documento nos relatórios. A Prefeitura de Unaí existe em
18 cadastros sob o mesmo CNPJ (Saúde, Cultura, Trânsito, Engenharia…) porque cada
secretaria tem empenho separado — isso é a operação real, não sujeira. Agrupar por
documento no relatório faz ela aparecer como o maior cliente da empresa (738 ordens,
R$ 304.083, 5,4% do faturamento), fato que o sistema atual esconde.
O campo `apelido` é obrigatório na busca: o operador conhece o cliente por ele. No legado,
"Cencosud Brasil Comercial" é o **Bretas** e "Associação de Ensino e Pesquisa de Unaí" é a
**FACTU**.

**Material** — nome, categoria, preço, unidade de cobrança (`m2` | `unidade` | `metro_linear`),
ativo. É **tabela de preço, não estoque**: não tem quantidade, saldo nem movimentação.

**OrdemServico** — numero (sequencial, continuando em 18.461), cliente_id (nullable),
estado_producao, aberta_em, prometida_para, concluida_em, responsavel_id, versao,
preco_calculado, preco_final, motivo_ajuste, ajustado_por.
Cliente é **opcional**: venda de balcão é 8,4% do movimento (1.547 ordens, o registro mais
usado da base inteira) e precisa de um clique.

**ItemOrdem** — ordem_id, descricao, material_id (nullable), quantidade, altura, largura,
unidade_cobranca, valor_unitario, total, ordem_exibicao.
Uma ordem mistura formas de cobrança. Uma fachada tem ACM por m², letras por unidade e
acabamento por metro linear.

**AcrescimoOrdem** — ordem_id, tipo (instalação, deslocamento, frete, imposto), descricao,
valor. Calculado sobre o total, não cadastrado como material.

**Recebimento** — ordem_id, data, valor, forma (obrigatória), usuario_id.
Vários por ordem. Não é contas-a-receber: sem parcela, sem juros, sem multa, sem
vencimento. Em 14 anos, 99,98% dos títulos são parcela 1 de 1 e vencimento é igual a
pagamento em 100% dos casos. O que existe é um **log de recebimento**.
Aceitar pagamento parcial conserta uma distorção real: o Instituto de Oncologia gerou 12
ordens em 01/04/2026 que eram 4 vendas fatiadas em 3 pagamentos cada, porque o sistema não
aceita parcial.

**ContaPlano** — codigo, nome, nivel, tipo (receita | despesa). Importar as 48 contas do
legado como estão, incluindo as contas pessoais dos sócios. O plano está vivo e evoluiu
até 2024.

**LancamentoCaixa** — data, tipo (entrada | saida), valor, conta_id, historico,
ordem_id (nullable), fornecedor (texto livre), parcela, total_parcelas, usuario_id.
Parcela fica na **saída**, não na venda: 43,4% das despesas do legado trazem `1/1`, `2/3`
digitados dentro do texto. A empresa parcela compra, não venda.

**Anexo** — ordem_id, tipo, chave_r2, nome_original, versao, enviado_por, enviado_em.

**LogAuditoria** — usuario_id, quando, entidade, entidade_id, campo, valor_anterior,
valor_novo. Tabela separada. No legado isso é uma string de 80 caracteres sobrescrita
dentro do próprio registro.

**OrdemLegado** — somente leitura. numero, data, cliente_nome, texto_completo, total,
situacao. As 18.443 ordens históricas, com o texto preservado como veio, aparecendo no
histórico do cliente sem contaminar o modelo novo.

---

## 5. Motor de preço

Vive em módulos TypeScript puros, sem importar nada de Next, com teste unitário próprio.
As 772 linhas de `ORDEM2` do legado servem de gabarito com resultado conhecido.

### As três fórmulas

| Unidade | Fórmula | Aderência no legado |
|---|---|---|
| `m2` | `altura × largura × valor_unitario × quantidade` | 345 de 365 (94,5%) |
| `unidade` | `valor_unitario × quantidade` | 407 de 407 (100%) |
| `metro_linear` | `2 × (altura + largura) × valor_unitario × quantidade` | 6 de 6 |

Metro linear é **perímetro**, não comprimento. Essa fórmula só apareceu porque uma
verificação independente foi checar uma afirmação e a derrubou; são 6 registros, todos de
2012, todos "recorte eletrônico".

### Composição do total

```
subtotal_itens   = Σ total de cada item
subtotal_acresc  = Σ valor de cada acréscimo
preco_calculado  = subtotal_itens + subtotal_acresc
preco_final      = preco_calculado ± ajuste manual
```

`preco_calculado` e `preco_final` são campos **separados e ambos persistidos** na ordem,
com `motivo_ajuste` e `ajustado_por`. O ajuste vai nos dois sentidos: desconto, ou
acréscimo para cobrir custo. Sem isso não há como medir margem real.

**`preco_calculado` é recalculado e regravado a cada alteração de item ou acréscimo**, na
mesma transação. Ele é derivado, mas persistido — não calculado em tempo de leitura. Dois
motivos: o preço praticado precisa ficar congelado no histórico mesmo que o preço do
material mude depois, e o relatório de margem não pode depender de recomputar 18 mil
ordens. Quando `preco_calculado` muda, `preco_final` **não** é sobrescrito se houver
ajuste manual registrado — a interface avisa que os dois divergiram e pede confirmação.

### O que não existe e por quê

**Não há aproveitamento de bobina.** Uma varredura nos nomes de campo das 52 tabelas do
legado não encontrou `BOBINA`, `ROLO`, `TINTA`, `MATERIAL`, `INSUMO`, `SOBRA` nem
`METRAGEM` — nenhum campo, em nenhuma tabela. Não é cálculo errado; é ausência total do
conceito. Implementar exigiria custo por material, largura de bobina e saldo de metragem,
alimentados por registro diário que a empresa nunca fez.

**Não há piso de cobrança automático**, embora ele exista na prática. Dentro do próprio
ACM, o preço mediano cai de R$ 417/m² em peças abaixo de 0,05 m² para R$ 260/m² acima de
0,75 m² — declínio monotônico, isolado dentro de um único material, então não é efeito de
mistura. É custo de setup aplicado por intuição. A v1 registra o preço praticado; a regra
fica para quando os donos conseguirem enunciá-la.

### Entrada assistida

O operador digita uma linha como escreveria no papel e o sistema estrutura antes de
confirmar:

```
digita:  12 placas ACM 61x40 61,00
vira:    qtd 12 · ACM 3mm · 0,61 × 0,40 m · R$ 61,00/un · R$ 732,00
```

O padrão `<qtd> <produto> <A>x<L> <valor>` aparece de forma consistente nos dados de 2011
a 2026. Dimensões podem vir em centímetros (`61x40`) ou metros (`0,61x0,40`) — a
heurística: token com separador decimal e valor menor que 10 é metro; caso contrário,
centímetro. O resultado é **sempre editável** antes de confirmar.

**Este é o risco número um do projeto.** O legado já ofereceu campos de altura, largura e
valor unitário com cálculo automático, e a empresa voltou a datilografar e somar na
calculadora. Se digitar item estruturado não for mais rápido que digitar texto livre, o
sistema novo será contornado do mesmo jeito.

---

## 6. Máquina de estados e fluxos

### Dois eixos independentes

**Produção** — `orcamento` → `aberta` → `concluida`, mais `cancelada` a partir de qualquer
ponto. Quatro estados.

**Pagamento** — `nao_pago` | `parcial` | `pago`. **Derivado** da soma dos recebimentos
contra `preco_final`. Nunca digitado, nunca armazenado como campo editável.

Separar os eixos é o que mata por construção os R$ 206 mil invisíveis: a tela inicial
mostra "concluídas e não pagas", e essa consulta só existe porque os dois estados são
independentes.

O legado tinha um eixo só (`CONTROLE`: A/F/C) mais uma tabela `SITUA` de 11 situações onde
duas concentram 98,7% do uso — e uma delas é apenas o valor de fábrica que ninguém troca.
**4.287 ordens finalizadas, com data de saída, ainda dizem "Aguardando Aprovação".**

### Sem estado de aprovação de arte

O legado tem o campo `DTAPROVA`. Ele está preenchido em 3,13% das ordens e, em 84,7%
desses casos, é apenas a data de entrada repetida. No período 2024–2026 a taxa é 0,72%.
Se aprovação formal de arte importar no negócio, é comportamento **novo** a desenhar do
zero, não migração de um campo ignorado por 14 anos.

### Sem "pronta para retirada"

Confirmado com os donos: o funcionário marca serviço finalizado, e pronto.

### Quem move cada eixo

Os dois eixos são movidos por pessoas diferentes, em momentos diferentes. Isso precisa
ficar explícito porque define duas ações que parecem a mesma:

**Produção → `concluida`.** O funcionário, na fila de produção, marca *serviço finalizado*.
É a única ação dele no sistema. Não toca em dinheiro.

**Pagamento.** A Odete registra um `Recebimento` quando o dinheiro entra — antes, junto ou
depois da conclusão. O eixo de pagamento é recalculado sozinho.

**"Concluir e receber" é um atalho**, não um terceiro estado. Existe para o caso mais comum
no balcão: o cliente busca a peça e paga na hora. O botão executa as duas coisas numa
transação só. Quem já teve o serviço finalizado pela produção vê apenas *"Receber"*.

### O fluxo que importa

```
cliente chega  →  nova ordem (com ou sem cadastro)
               →  itens: digita a linha, sistema estrutura
               →  imprime, entrega a via ao cliente
               →  produção executa e marca serviço finalizado   → estado: concluída
               →  Odete registra o recebimento                  → eixo de pagamento: pago
                  (no balcão, os dois passos acima viram um botão só)
               →  lança no caixa automaticamente, na mesma transação
```

O ponto invariante: **registrar recebimento e lançar no caixa nunca são operações
separadas.** No legado são telas diferentes, e é por isso que 372 ordens precificadas
nunca viraram título.

---

## 7. Telas

### Atendimento

1. **Fila de trabalho** — tela inicial. Duas listas: abertas há mais de uma semana, e
   concluídas não pagas com o total somado. Busca por número, cliente ou apelido.
   Não é dashboard de gráficos.
2. **Ordem de serviço** — cabeçalho, entrada assistida, lista de itens, painel de totais
   com preço calculado e final, ações. A tela mais importante do sistema.
3. **Lista de ordens** — filtro por estado e período, busca, ordenação. Cada linha mostra
   os dois eixos de estado.
4. **Ficha do cliente** — contato e histórico completo de ordens, incluindo as legadas.
5. **Lista de clientes** — busca por nome, apelido ou telefone. Aviso de duplicidade por
   telefone ao cadastrar.
6. **Registrar recebimento** — valor, forma (obrigatória), data. Aceita parcial.
7. **Impresso da ordem** — A4. Seis blocos: cabeçalho da empresa, identificação, cliente
   com contato, corpo do serviço, forma de pagamento, valores, assinatura.

### Produção

8. **Fila de produção** — o que fazer, em ordem de urgência. Densidade baixa, tipo grande,
   alvos de toque de no mínimo 44px. Botão de serviço finalizado por ordem.

### Administração

9. **Operação** — indicadores do momento e histórico ano a ano.
10. **Financeiro** — livro-caixa com entradas e saídas.
11. **Plano de contas** — as 48 contas em 5 grupos.
12. **Clientes (administração)** — concentração de receita, recência, lista de reativação.
13. **Materiais e preços** — catálogo com regra de cobrança por material.
14. **Usuários** — dois papéis.
15. **Dados da empresa** — o que sai no impresso.

### Transversais

16. **Entrar** — login simples.
17. **Estados vazios** — primeira vez, busca sem resultado, fila vazia. Ensinam o que fazer.
18. **Erros** — falha de gravação, e conflito de edição concorrente.

### Regras de interface

- Nenhum campo com valor pré-selecionado que ninguém troca. No legado, 99,5% das ordens
  dizem "Avista" porque era o valor de fábrica, e as seis flags booleanas de forma de
  pagamento **nunca foram marcadas** em 18.443 registros. Ou o campo é obrigatório e
  significa algo, ou não existe.
- Teclado primeiro na tela de ordem. Nenhum modal para o que se faz 50 vezes por dia.
- Números alinhados à direita, fonte tabular.
- Vocabulário da loja: *Ordem de Serviço*, *Orçamento*, *Observações*, *Responsável*,
  *Situação*, *dar baixa*, *Serviço finalizado*. Nada de termo inventado.

---

## 8. Stack e arquitetura

| Camada | Escolha |
|---|---|
| Aplicação | Next.js (App Router) + TypeScript |
| Banco | PostgreSQL |
| ORM | Prisma |
| UI | `@tabler/core` (Bootstrap 5, MIT) + `react-bootstrap` |
| Ícones | `@tabler/icons-react` (MIT, 6.184 ícones) |
| Tipografia | Geist e Geist Mono |
| Auth | Credenciais + Argon2, sessão em cookie |
| Impresso | HTML com CSS de impressão |
| Arquivos | Cloudflare R2 |
| Testes | Vitest (unitário) + Playwright (ponta a ponta) |
| Hospedagem | Vercel Pro + Neon São Paulo (`sa-east-1`) |

**Custo:** ~R$ 216/mês (US$ 39 à taxa efetiva de R$ 5,45 com IOF de 3,5%), dentro do teto
de R$ 500. Docker desde o início para manter aberta a migração para VPS em 6–12 meses.

**Verificado:** o plano Hobby da Vercel proíbe uso comercial — *"Hobby teams are restricted
to non-commercial personal use only"*. O free tier do Neon oferece apenas 6 horas de
point-in-time restore, insuficiente para dados de empresa.

### A regra de arquitetura

**Motor de preço e máquina de estados ficam em módulos TypeScript puros**, sem importar
nada de Next, com teste unitário próprio. O framework é casca descartável. Next.js tem
histórico real de quebra entre versões; quando quebrar, troca-se a casca e o núcleo
permanece.

### Paleta

| Token | Valor | Contraste com branco |
|---|---|---|
| `primary` | `#0E7C93` | 4,86:1 |
| `primary-hover` | `#0A6478` | 6,76:1 |
| `primary-light` | `#E4F2F6` | fundo |
| ciano da marca | `#5FC4D8` | **2,02:1 — nunca como cor de botão** |

O ciano da logo é claro demais para ser cor de ação. Serve para fundos claros e como
primária no tema escuro, que é como ele vive na própria logo.

---

## 9. Confiabilidade

Esta seção existe porque o sistema atual perdeu R$ 166 mil por não gravar direito.

**Transação única.** Concluir a ordem, registrar o recebimento e lançar no caixa acontecem
numa transação só. Ou tudo, ou nada. Não existe estado intermediário para alguém descobrir
seis meses depois.

**Idempotência.** Toda mutação carrega chave de idempotência. Se a conexão cai depois do
commit e antes da resposta, o retry não duplica.

**Sem sucesso otimista em dinheiro.** Para gravar ordem e recebimento, o retorno vem
depois do commit. Perder 300 ms vale menos que perder confiança.

**Trava otimista.** Campo `versao` na ordem. Quem salvar sobre uma edição alheia recebe
aviso com o diff, não sobrescrita silenciosa.

**Backup.** PITR de 7 dias do Neon, dump semanal para o R2 com retenção de 30 dias, e um
**teste de restauração executado antes de ir para produção**. Backup não testado é backup
que não existe.

---

## 10. Migração de dados

Origem: `C:\legacy-drusign-dados` — 265 arquivos DBF extraídos, sem executáveis.
Encoding **CP1252**, confirmado por medição de caracteres inválidos contra CP850 e
Latin-1.

**Clientes** — todos os 3.219, incluindo os 1.978 marcados como apagados, importados como
arquivados. Eles carregam 6.328 ordens (34,3% do total) e R$ 1.341.938 (23,7% do
faturamento). Perdê-los é perder um terço do histórico comercial.

**Ordens** — as 18.443 entram em `OrdemLegado`, somente leitura, com o texto de `OBS1..OBS7`
preservado como veio. Não tentar estruturar o texto antigo: a extração varia até 2,2×
conforme a regra de centímetro versus metro, e histórico estruturado errado é pior que
texto honesto.

**Plano de contas** — as 48 contas como estão.

**Normalização de telefone** — etapa obrigatória. **Zero números na base têm 11 dígitos**;
a máscara do legado é `(99)9999-9999` e fisicamente não cabe o nono dígito. Regra: DDD mais
8 dígitos começando em 6/7/8/9 recebe o `9` prefixado — 1.960 números afetados. Guardar o
original e o normalizado lado a lado, com flag de inferido. Sem isso a lista de 1.488
contatos para reativação é inutilizável.

**Sujeira conhecida a tratar:** 271 ordens com data de saída anterior à entrada, 10 datas
absurdas (uma diz `0706-06-07`), e 3.152 nomes de cliente destruídos pelo cancelamento no
legado.

---

## 11. Critérios de sucesso

Linha de base medida nos 14 anos de dados.

| Indicador | Hoje | Alvo |
|---|---|---|
| Ordens que nunca são finalizadas | 29,4% (2025) | < 5% |
| Valor parado em ordens não cobradas | R$ 207.795 | ≈ 0 |
| Pessoas usando o sistema | 1 | 2 ou mais |
| Ordens com item estruturado | 0% | > 90% |
| Cadastros com telefone discável | 0 | ~2.600 |
| Prazo mediano de entrega | 13 dias (p90 78) | observar |

O termômetro: **quantas ordens foram concluídas e recebidas sem sair do sistema.**

---

## 12. Fora de escopo

Cada item é uma tela que o legado tem, que foi paga, e que ninguém usou.

| Módulo | Evidência em 14 anos |
|---|---|
| Contas a pagar | 24 títulos, abandonado em 2 meses, em 2012 |
| Vendas / Pedido | 3 registros |
| Compras / entrada de nota | 9 compras, todas de 2012; 0 entradas |
| Controle de estoque | 12 campos existem e nunca funcionaram; saldos negativos |
| Aproveitamento de bobina | nenhum conceito de material em nenhuma das 52 tabelas |
| Vendedor / comissão | 0 registros; uma pessoa faz 84,6% das ordens |
| Permissões granulares | 65 flags; 3 usuários, todos com tudo ligado |
| Assistência técnica | herança de 2007; tabelas com demo do fornecedor |
| Envio de e-mail | SMTP ainda é o e-mail pessoal do autor do software |
| Multi-caixa / transferência | 99,94% num único caixa; campos de origem e destino zerados |
| Emissão fiscal | o contador emite tudo; o sistema exporta relatório |
| Integração WhatsApp | apenas botão que abre a conversa; a integração oficial fica no site de captação, outro projeto |

---

## 13. Faseamento

O escopo é grande demais para um plano de implementação único. Seis fases, cada uma
entregando algo verificável e nenhuma dependendo de trabalho futuro para ter valor.

**Fase 1 — Fundação e domínio.** Scaffolding, banco, migrações, autenticação, layout base
com Tabler. E o motor de preço em módulos TypeScript puros, com teste unitário contra as
772 linhas de gabarito extraídas do `ORDEM2`.
*Verificação:* as três fórmulas reproduzem os resultados conhecidos do legado.

**Fase 2 — Cadastros e clientes reais.** Cliente, material, e a importação dos 3.219
clientes com a normalização de telefone.
*Verificação:* busca por apelido acha o Bretas e a FACTU; nenhum telefone com 10 dígitos
sobrou; os 1.978 apagados entraram como arquivados.

**Fase 3 — Ordem de serviço.** OS, entrada assistida, itens com as três formas de cobrança,
acréscimos, ajuste de preço, e o impresso.
*Verificação:* reproduzir a OS 18449 do legado — seis itens de ACM somando R$ 2.528,00.

**Fase 4 — Dinheiro.** Recebimento, livro-caixa, plano de contas, a transação única, e a
fila de trabalho.
*Verificação:* concluir e receber grava os três registros ou nenhum; a fila mostra
corretamente "concluídas e não pagas". **É o marco em que o legado pode ser desligado.**

**Fase 5 — Produção e administração.** Fila de produção, dashboard de operação, visão
administrativa de clientes, configurações.

**Fase 6 — Histórico e complementos.** Importação das 18.443 ordens legadas como arquivo,
anexo de arte, relatório para o contador, estados vazios refinados.

Cada fase ganha seu próprio plano de implementação. Não escrever o plano da fase seguinte
antes da anterior estar rodando em produção.

---

## 14. Pendências

Nenhuma bloqueia o início da implementação.

1. **Cálculos exatos por material** — os donos vão passar. Enquanto não chegam, o motor
   opera com as três fórmulas conhecidas e o catálogo nasce vazio para ser preenchido.
2. **Recorte e acabamento ainda são cobrados por perímetro?** O legado calcula assim, mas
   com 6 registros, todos de 2012.
3. **Anexo de arte entra na v1 ou na v2?** Decisão do Otavio: cedo se não atrapalhar.
4. **Base visual** — Tabler escolhido; falta o Otavio validar a aparência em
   `preview.tabler.io`.

---

## 15. Ação fora do projeto

**Investigar a rede da loja.** R$ 207.795 estão parados por causa de um mapeamento de rede
que mudou junto com o endereço, em abril de 2025. Isso não espera o sistema novo — pode
ser questão de uma tarde. E fazer cópia fria da pasta `DADOS` antes de mexer em qualquer
coisa.

**Verificar a máquina da loja.** O Windows Defender detectou `Virus:Win32/Floxif.H` em duas
DLLs do pacote do legado. É assinatura específica de infector de arquivos, não heurística.
Confirmar subindo os dois arquivos no VirusTotal.
