import type { Metadata } from 'next'
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
  Receitas: 'O dinheiro que entra. Uma destas recebe os pagamentos das ordens.',
  'Custos da produção': 'O que você compra para fazer o serviço: material, chapa, terceiro, frete.',
  'Despesas fixas': 'O que a loja paga todo mês, com ou sem venda.',
  'Outras despesas': 'O que não cabe nos outros grupos.',
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
      />
      <CorpoPagina>
        {/* As duas unicas coisas que o plano decide na pratica. Antes a tela
            abria com um formulario de cadastro, e quem nao conhecia a palavra
            "plano de contas" nao descobria para que servia nenhuma linha. */}
        <div className="card mb-3">
          <div className="card-body">
            <dl className="ficha-dados mb-0">
              <dt>Quando você recebe uma ordem</dt>
              <dd>
                {recebimento ? (
                  <>
                    O valor entra em <strong>{recebimento.nome}</strong>, sem você escolher nada.
                  </>
                ) : (
                  <span className="text-danger-emphasis">
                    Nenhuma conta está marcada para receber. Enquanto isso, receber uma ordem é
                    recusado: escolha uma conta de receita abaixo e clique em “Usar para recebimentos”.
                  </span>
                )}
              </dd>
              <dt>Quando você paga alguma coisa</dt>
              <dd>
                Em <Link href="/financeiro/saida">Nova saída</Link> você escolhe por qual das{' '}
                {contar(despesasAtivas, 'conta de despesa ativa', 'contas de despesa ativas')} o dinheiro saiu.
              </dd>
            </dl>
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
          grupos.map((g) => (
            <CartaoTabela
              className="mb-3"
              key={g}
              rotulo={`Contas de ${g}`}
              titulo={g}
              aoLado={PARA_QUE[g] ? <span className="text-secondary">{PARA_QUE[g]}</span> : null}
              /* Larguras fixas: sao quatro tabelas empilhadas, e sem isto cada
                 uma dimensiona as colunas pelo proprio conteudo -- "Tipo" caia
                 em quatro alturas diferentes e a tela parecia desalinhada. */
              colunas={
                <>
                  <th style={{ width: '5rem' }}>Código</th>
                  <th>Conta</th>
                  <th style={{ width: '9rem' }}>Tipo</th>
                  <th style={{ width: '15rem' }}></th>
                </>
              }
            >
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
            </CartaoTabela>
          ))
        )}

        {/* O cadastro vem depois da lista: quem abre a tela quer ver o que ja
            tem, e o grupo novo quase sempre e um que ja existe. */}
        <div className="card">
          <div className="card-header"><h2 className="card-title">Criar conta</h2></div>
          <div className="card-body">
            <FormConta grupos={grupos} />
          </div>
        </div>
      </CorpoPagina>
    </>
  )
}
