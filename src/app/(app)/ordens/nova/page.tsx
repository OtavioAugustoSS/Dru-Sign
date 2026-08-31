import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { exigirUsuario } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { Abas } from '@/componentes/abas'
import { prisma } from '@/infra/db/prisma'
import { BuscaCliente } from './busca-cliente'
import { criarOrdemAction } from './actions'

export const metadata: Metadata = { title: 'Nova ordem' }

/**
 * Escolher a aba mostra o formulário DAQUELA coisa, abaixo da faixa.
 *
 * Antes eram dois botões que criavam na hora, e depois foram duas abas com um
 * cartão de explicação e um segundo botão -- que continuava sendo um passo a
 * mais para chegar no mesmo lugar. Agora a aba escolhe O QUE se está abrindo e o
 * formulário abaixo é o próprio ato de abrir.
 *
 * E a ordem nasce com cabeçalho. O fluxo anterior criava um registro em branco e
 * jogava a pessoa na tela da ordem para preencher cliente e prazo: duas telas
 * para uma decisão, e um número de OS gasto antes de alguém dizer de quem a
 * ordem era.
 *
 * O formulário é `<form action={serverAction}>`: funciona antes de hidratar, com
 * JavaScript ou sem. Só a busca de cliente precisa de JS, e precisa por natureza.
 */
export default async function PaginaNovaOrdem({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const usuario = await exigirUsuario()
  const { tipo } = await searchParams
  const orcamento = tipo === 'orcamento'
  // Só quem está ativo pode ser responsável, e a consulta é a mesma da tela da
  // ordem: quem some do sistema não pode continuar aparecendo como opção.
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: usuario.empresaId, ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })

  // A chave nasce no render do servidor: reenviar o mesmo formulário reaproveita
  // a chave e não cria duas ordens.
  const chave = randomUUID()

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/ordens', rotulo: 'Ordens' }}
        titulo="Nova ordem"
        descricao="O que o cliente quer agora: um serviço para produzir, ou um preço para ele decidir depois."
      />
      <CorpoPagina>
        <div className="formulario-estreito">
          <Abas
            rotulo="Tipo do registro"
            base="/ordens/nova"
            parametro="tipo"
            atual={orcamento ? 'orcamento' : 'servico'}
            abas={[
              { valor: 'servico', rotulo: 'Ordem de serviço' },
              { valor: 'orcamento', rotulo: 'Orçamento' },
            ]}
          />

          <form action={criarOrdemAction} className="card">
            <input type="hidden" name="chave" value={chave} />
            <input type="hidden" name="estado" value={orcamento ? 'orcamento' : 'aberta'} />

            <div className="card-body row g-3">
              <div className="col-12">
                {/* Uma linha, não um cartaz: o que muda entre as duas abas é
                    exatamente isto, e é o que decide qual escolher. */}
                <p className="text-secondary m-0">
                  {orcamento
                    ? 'Orçamento não entra na fila da produção — ninguém produz por engano o que o cliente ainda não fechou. Aprovar depois não recria nada: o mesmo registro vira ordem e o preço aprovado fica travado.'
                    : 'Entra na fila da produção assim que você lançar os itens, e o número da OS já vale. O dinheiro só entra quando você receber.'}
                </p>
              </div>

              <div className="col-md-7">
                <BuscaCliente />
              </div>

              <div className="col-md-5">
                <label className="form-label" htmlFor="prometidaPara">Entrega prometida</label>
                <input id="prometidaPara" name="prometidaPara" type="date" className="form-control" />
                <div className="form-hint">
                  {orcamento ? 'Dá para combinar depois, quando ele aprovar.' : 'É o que ordena a fila da bancada.'}
                </div>
              </div>

              <div className="col-md-7">
                <label className="form-label" htmlFor="responsavelId">Responsável</label>
                <select id="responsavelId" name="responsavelId" className="form-select" defaultValue={usuario.id}>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <div className="form-hint">Quem atendeu, para a bancada saber a quem perguntar.</div>
              </div>

              <div className="col-12">
                {/* O rótulo diz o que vai acontecer, não "Confirmar". */}
                <button type="submit" className="btn btn-primary btn-lg" autoFocus>
                  {orcamento ? 'Abrir orçamento' : 'Abrir ordem de serviço'}
                </button>
                <div className="form-hint mt-2">
                  Os itens você lança na tela seguinte, digitando como no papel.
                </div>
              </div>
            </div>
          </form>
        </div>
      </CorpoPagina>
    </>
  )
}
