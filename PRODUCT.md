# PRODUCT.md — DruSign

> Escrito a partir da spec (`docs/superpowers/specs/2026-08-27-sistema-drusign-design.md`),
> do código existente e das palavras do Otavio registradas ao longo do projeto.
> Nada aqui foi inventado; se algum item estiver errado, corrija — este arquivo
> é lido por toda ferramenta de design antes de tocar em qualquer tela.

## Register

**Product.** Design SERVE o produto. É sistema de gestão autenticado: fila de
trabalho, ordens de serviço, livro-caixa, tabelas densas, formulários. Não há
superfície de marketing. Nenhuma tela existe para ser admirada; toda tela existe
para alguém terminar uma tarefa e sair.

## Quem usa, e onde

Duas pessoas, o dia inteiro, na DruSign Placas e Comunicação Visual (Unaí/MG):

- **Administração (Odete)** — no balcão, atendendo cliente enquanto usa o sistema.
  Abre ordem, cobra, lança no caixa, procura o que o cliente pediu ano passado.
  Interrompida o tempo todo. Tela cheia de número e nome.
- **Produção** — na bancada, **de pé, às vezes de luva, às vezes contra a luz da
  janela**. Lê de longe. Precisa de alvo de toque grande (`.botao-producao`,
  56px) e de quase nenhum valor em dinheiro na tela.

Isto substitui o OSGRAFICA 4.5A, que quebrou e deixou R$ 207.795 parados em 513
ordens abertas. O sistema roda o negócio da família; ele não pode ser bonito e
lento.

## O trabalho, não a visita

**Visita 400, não visita 1.** Movimento que encanta na primeira vez custa tempo
na milésima. O alvo de qualquer interação é **continuidade** (não perdi meu
lugar) e **resposta** (o sistema ouviu meu clique), nunca deleite.

Consequência prática: a mesma tela é aberta dezenas de vezes por dia. Qualquer
animação que a pessoa tenha que *esperar terminar* é um imposto cobrado
centenas de vezes.

## Princípios de design já decididos

Estes não são preferências, são decisões tomadas contra alternativas concretas
(ver `drusign-design-fechado`). Mudar exige conversa com o Otavio.

1. **Todo número é porta.** Indicador no topo de tela leva ao recorte que ele
   conta. Número que só informa obriga a pessoa a descobrir o caminho sozinha.
2. **Ponto, não selo.** Situação é um ponto de 10px colorido mais a palavra na
   cor do corpo. Não existe badge no sistema.
3. **Gráfico é CSS no servidor**, sem biblioteca. As cores saem dos mesmos
   tokens `--ponto-*` da situação, então verde quer dizer a mesma coisa no
   gráfico e na lista de ordens.
4. **Estado que a pessoa escolhe mora no endereço**, não na memória do navegador:
   aba, página, ordenação e filtro sobrevivem ao recarregar e podem ser enviados
   a outra pessoa.
5. **Quase zero JavaScript no navegador é qualidade**, não acaso.
6. **Vocabulário da loja**: Ordem de Serviço, Orçamento, Situação, Serviço
   finalizado, dar baixa. Nada de termo inventado.

## Anti-referências

O que este sistema explicitamente NÃO deve parecer, nas palavras do Otavio:

- **"Aparência de IA"** — três direções visuais já foram rejeitadas por isso. O
  tell não é feiura: é uniformidade. Tela onde tudo tem o mesmo peso e tudo se
  mexe do mesmo jeito lê como gerada.
- **Painel administrativo genérico** — o mesmo layout com paleta trocada.
- **Dado enfeitado** — *"sem q pareça IA para representar dados"*.

Proibido explicitamente nesta fase: fade ao rolar, hover que levanta cartão,
texto com gradiente, vidro fosco, número que sobe contando, easing com bounce ou
elástico, spinner onde cabe esqueleto, e animar propriedade que causa layout.

## Acessibilidade

- **WCAG 2.1 AA, medido, não estimado.** Todo par de cor do sistema foi
  calculado por luminância relativa; os comentários de `src/app/tema.css`
  carregam os números. Contraste se mede pela técnica do canvas 1x1 — ler `rgb()`
  na mão já falhou três vezes neste projeto.
- **`prefers-reduced-motion` é obrigatório em toda animação**, não opcional.
- Anel de foco visível em todo controle (`:focus-visible`, 2px na primária,
  offset 2px). Foi o defeito mais grave já achado no sistema.
- Cor nunca carrega significado sozinha: o ponto colorido sempre vem com a
  palavra ao lado.
- **Uma face só, e ela é escura** (decisão do Otavio em 31/08/2026). Não há
  seletor de tema, não há cookie de tema, não há modo claro. A única superfície
  clara do sistema é a folha impressa, que se declara sozinha com
  `data-bs-theme="light"` no próprio `<main>` — papel é branco com tinta preta em
  qualquer sistema. Em `tema.css` isso significa: o padrão vive no `:root` e o
  par claro existe só onde a folha precisa dele.

## Restrições

Dev solo, 4h/dia, até R$ 500/mês de custeio. Next.js (App Router) + TypeScript +
Prisma + `@tabler/core` 1.4.0 (Bootstrap 5, MIT) + Geist. Motor de preço e
máquina de estados são TypeScript puro, fora do framework. Licença de qualquer
dependência é verificada ANTES de entrar.
