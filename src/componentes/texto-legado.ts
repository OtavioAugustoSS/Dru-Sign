/**
 * Limpa o que o sistema antigo escrevia no lugar de campo vazio.
 *
 * As ordens antigas guardavam a descricao em sete campos, OBS1 a OBS7. Campo sem
 * uso nao ficava em branco: ficava com um ponto. Ao juntar os sete numa coluna
 * so, cada ordem virava um bloco com uma ou duas linhas de conteudo e cinco de
 * pontos soltos -- e a tela do arquivo passava de nove mil pixels por causa
 * disso.
 *
 * Ponto solitario nao e o que a pessoa digitou: e como o banco antigo marcava
 * "aqui nao tem nada". Tirar essas linhas mostra MAIS fielmente o que foi
 * escrito, nao menos. Nada e alterado no banco: isto e so exibicao.
 */
export function limparTextoLegado(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => {
      const limpa = linha.trim()
      return limpa !== '' && limpa !== '.'
    })
    .join('\n')
}
