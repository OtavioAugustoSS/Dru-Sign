import type { Metadata } from 'next'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { carregarFila } from '@/infra/caixa/fila'
import { contagensDeOrdens } from '@/infra/ordens/repositorio'
import { contagensDeClientes } from '@/infra/clientes/repositorio'
import { carregarFilaProducao } from '@/infra/producao/fila'
import { FilaDeTrabalho } from './fila-trabalho'
import { FilaDeProducao } from './producao/fila-producao'

export const metadata: Metadata = { title: 'Fila' }

/**
 * Quem e da producao trabalha de pe e olhando de longe (spec, secao 3): a tela dele e a
 * fila de producao, e ela e a primeira coisa que aparece — nao um item de menu que ele
 * precisa lembrar de clicar.
 */
export default async function PaginaInicial() {
  const usuario = await exigirUsuario()
  if (usuario.papel === 'operacao') {
    return <FilaDeProducao fila={await carregarFilaProducao(usuario.empresaId)} />
  }
  const [fila, ordens, clientes] = await Promise.all([
    carregarFila(usuario.empresaId),
    contagensDeOrdens(usuario.empresaId),
    contagensDeClientes(usuario.empresaId),
  ])
  return <FilaDeTrabalho fila={fila} ordens={ordens} clientes={clientes} />
}
