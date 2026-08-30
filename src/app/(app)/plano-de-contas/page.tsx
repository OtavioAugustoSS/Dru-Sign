import type { Metadata } from 'next'
import { Fragment } from 'react'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { contar } from '@/componentes/plural'
import { Anotacao, SituacaoTipoConta } from '@/componentes/situacao'
import { listarContas } from '@/infra/caixa/plano'
import { FormConta } from './form-conta'
import { AcoesConta } from './acoes-conta'

export const metadata: Metadata = { title: 'Plano de contas' }

/** Onde cada grupo aparece no dia a dia. Sem isto, "grupo" e so um titulo. */
const PARA_QUE: Record<string, string> = {
  Receitas: 'o dinheiro que entra',
  'Custos da produção': 'o que você compra para fazer o serviço',
  'Despesas fixas': 'o que a loja paga todo mês, com ou sem venda',
  'Outras despesas': 'o que não cabe nos outros grupos',
}

export default async function PaginaPlano({ searchParams }: { searchParams: Promise<{ inativas?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { inativas } = await searchParams
  const contas = await listarContas(usuario.empresaId, { incluirInativas: inativas === '1' })
  const grupos = [...new Set(contas.map((c) => c.grupo))]
  const recebimento = contas.find((c) => c.recebeVendas)
  const despesasAtivas = contas.filter((c) => c.tipo === 'despesa' && c.ativa).length

  return (
    <>
      <CabecalhoPagina
        pretitulo="Financeiro"
        titulo="Plano de contas"
        descricao="Toda entrada e toda saída do caixa precisa dizer por qual conta passou. Esta é a lista dessas contas, e é ela que faz o relatório do contador somar por categoria no fim do mês."
        /* O cadastro no cabecalho, e nao num cartao depois da lista. Era ali que
           ele estava, e para chegar nele a pessoa tinha de rolar a tela inteira
           -- foi essa a reclamacao de "nao consigo descer ate o final". */
        acoes={
          <a href="#criar" className="btn btn-primary">Criar conta</a>
        }
      />
      <CorpoPagina>
        {/* As duas unicas coisas que o plano decide na pratica. Uma linha cada:
            eram dois blocos de rotulo e valor, e ocupavam meia tela para dizer
            duas frases. */}
        <div className="card mb-3">
          <div className="card-body py-2">
            <p className="m-0">
              <strong>Você recebe uma ordem:</strong>{' '}
              {recebimento ? (
                <>o valor entra em <strong>{recebimento.nome}</strong>, sem escolher nada.</>
              ) : (
                <span className="text-danger-emphasis">
                  nenhuma conta está marcada para receber, e enquanto isso receber é recusado. Escolha
                  uma conta de receita abaixo e clique em “Usar para recebimentos”.
                </span>
              )}
            </p>
            <p className="m-0">
              <strong>Você paga alguma coisa:</strong> em <Link href="/financeiro/saida">Nova saída</Link>{' '}
              você escolhe por qual das {contar(despesasAtivas, 'conta de despesa ativa', 'contas de despesa ativas')} o dinheiro saiu.
            </p>
          </div>
        </div>

        <form method="get" className="d-flex align-items-center gap-3 mb-3">
          <label className="form-check m-0">
            <input className="form-check-input" type="checkbox" name="inativas" value="1" defaultChecked={inativas === '1'} />
            <span className="form-check-label">Mostrar desativadas</span>
          </label>
          <button type="submit" className="btn btn-sm">Mostrar</button>
        </form>

        {contas.length === 0 ? (
          <EstadoVazio
            titulo="O plano de contas está vazio"
            descricao="É a lista de para onde vai cada entrada e cada saída do caixa. Crie a primeira conta no formulário abaixo — comece por uma de receita, que é onde os recebimentos das ordens vão cair."
          />
        ) : (
          /* Uma tabela so, com linha de grupo no meio, no lugar de quatro
             cartoes empilhados. Cada cartao trazia cabecalho proprio e uma nova
             linha de titulos de coluna: quinze contas ocupavam 1.700px de
             rolagem, e as colunas de cada tabela se dimensionavam sozinhas. */
          <CartaoTabela
            className="mb-3"
            /* Denso: e lista de configuracao, nao de leitura. Quinze linhas na
               altura de fabrica gastavam 800px so de linhas. */
            denso
            rotulo="Plano de contas"
            titulo="As contas"
            aoLado={<span className="text-secondary">{contar(contas.length, 'conta', 'contas')}</span>}
            colunas={
              <>
                <th style={{ width: '5rem' }}>Código</th>
                <th>Conta</th>
                <th style={{ width: '9rem' }}>Tipo</th>
                <th style={{ width: '15rem' }}></th>
              </>
            }
          >
            {grupos.map((g) => (
              <Fragment key={g}>
                <tr className="linha-grupo">
                  <th colSpan={4} scope="colgroup">
                    {g}
                    {PARA_QUE[g] ? <Anotacao>{PARA_QUE[g]}</Anotacao> : null}
                  </th>
                </tr>
                {contas.filter((c) => c.grupo === g).map((c) => (
                  <tr key={c.id} className={c.ativa ? '' : 'text-secondary'}>
                    <td className="numero text-secondary">{c.codigo}</td>
                    <td>
                      {c.nome}
                      {c.recebeVendas ? <Anotacao tom="bom">recebe os pagamentos das ordens</Anotacao> : null}
                      {/* Quantas vezes ja foi usada: e o que diz se da para
                          excluir sem perder historico. Como quase toda conta
                          comeca em zero, isto e anotacao e nao coluna -- uma
                          coluna inteira de travessao nao informa nada. */}
                      {c.lancamentos > 0 ? <Anotacao>{contar(c.lancamentos, 'lançamento', 'lançamentos')}</Anotacao> : null}
                      {c.ativa ? null : <Anotacao>desativada, não aparece em Nova saída</Anotacao>}
                    </td>
                    <td><SituacaoTipoConta tipo={c.tipo} /></td>
                    <td className="text-end">
                      <AcoesConta contaId={c.id} nome={c.nome} ativa={c.ativa} receita={c.tipo === 'receita'} recebeVendas={c.recebeVendas} usos={c.lancamentos} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </CartaoTabela>
        )}

        <div className="card" id="criar">
          <div className="card-header"><h2 className="card-title">Criar conta</h2></div>
          <div className="card-body">
            <FormConta grupos={grupos} />
          </div>
        </div>
      </CorpoPagina>
    </>
  )
}
