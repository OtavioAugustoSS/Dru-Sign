/**
 * Substituto de `server-only` nos testes de integracao.
 *
 * O pacote `server-only` existe para QUEBRAR O BUILD quando um modulo de
 * servidor e importado por um componente de cliente -- ele nao faz nada em
 * tempo de execucao, so exporta um erro pelo campo `browser` do package.json.
 * O Vitest resolve esse campo e o teste morria com "cannot be imported from a
 * Client Component", que aqui e mentira: o teste de integracao roda em Node e
 * E o servidor.
 *
 * Vazio de proposito. A protecao que importa continua valendo onde importa: no
 * `next build`, que e quem monta o bundle do navegador.
 */
export {}
