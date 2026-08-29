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
