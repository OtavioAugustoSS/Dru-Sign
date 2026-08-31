import { NaoEncontrado } from '@/componentes/nao-encontrado'

/**
 * O limite de último recurso, para rota dentro do app que não tenha um
 * `not-found` próprio. Cada cadastro que se busca por endereço tem o seu,
 * porque a saída útil depende do que se procurava.
 */
export default function NaoEncontradoNoApp() {
  return <NaoEncontrado oQue="esse registro" href="/ordens" rotulo="Ver as ordens" />
}
