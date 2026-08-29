/** Erro de regra de negocio: a action devolve a mensagem ao operador. Qualquer outro erro estoura. */
export class ErroDeValidacao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeValidacao'
  }
}
