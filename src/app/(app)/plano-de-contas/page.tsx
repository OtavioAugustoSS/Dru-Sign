import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Anotacao, SituacaoTipoConta } from '@/componentes/situacao'
import { listarContas } from '@/infra/caixa/plano'
import { FormConta } from './form-conta'
import { AcoesConta } from './acoes-conta'

export const metadata: Metadata = { title: 'Plano de contas' }

export default async function PaginaPlano({ searchParams }: { searchParams: Promise<{ inativas?: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { inativas } = await searchParams
  const contas = await listarContas(usuario.empresaId, { incluirInativas: inativas === '1' })
  const grupos = [...new Set(contas.map((c) => c.grupo))]
  const semVendas = !contas.some((c) => c.recebeVendas)

  return (
    <>
      <CabecalhoPagina pretitulo="Financeiro" titulo="Plano de contas" />
      <CorpoPagina>
        {semVendas ? (
          <div className="alert alert-warning" role="alert">
            {/* Aspas curvas: aspa reta no meio de texto em portugues e marca de
                codigo, nao de citacao. */}
            Nenhuma conta recebe as vendas. Escolha uma conta de receita e clique em “Usar para
            recebimentos” — sem isso, receber é recusado.
          </div>
        ) : null}

        <div className="card mb-3">
          <div className="card-body">
            <FormConta grupos={grupos} />
          </div>
        </div>

        {/* O botao era "Atualizar", em estilo de link, e nao existia igual em
            nenhuma outra tela. As telas com filtro dizem "Mostrar" e usam botao
            de verdade; esta passa a dizer o mesmo. */}
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
            descricao="É a lista de para onde vai cada entrada e cada saída do caixa. Crie a primeira conta acima — ou peça a importação das 48 contas que o sistema antigo já tinha."
          />
        ) : (
          grupos.map((g) => (
            <CartaoTabela
              className="mb-3"
              key={g}
              rotulo={`Contas de ${g}`}
              titulo={g}
              colunas={
                <>
                  <th className="w-1">Código</th>
                  <th>Conta</th>
                  <th>Tipo</th>
                  <th className="w-1"></th>
                </>
              }
            >
              {contas.filter((c) => c.grupo === g).map((c) => (
                <tr key={c.id} className={c.ativa ? '' : 'text-secondary'}>
                  <td className="numero">{c.codigo}</td>
                  <td>
                    {c.nome}
                    {c.recebeVendas ? <Anotacao tom="bom">recebe as vendas</Anotacao> : null}
                    {c.ativa ? null : <Anotacao>desativada</Anotacao>}
                  </td>
                  <td><SituacaoTipoConta tipo={c.tipo} /></td>
                  <td><AcoesConta contaId={c.id} ativa={c.ativa} receita={c.tipo === 'receita'} recebeVendas={c.recebeVendas} /></td>
                </tr>
              ))}
            </CartaoTabela>
          ))
        )}
      </CorpoPagina>
    </>
  )
}
