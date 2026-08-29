import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarMateriais } from '@/infra/materiais/repositorio'
import { rotuloUnidade } from '@/infra/materiais/unidades'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { CartaoTabela } from '@/componentes/cartao-tabela'
import { Selo } from '@/componentes/selo'
import { EstadoVazio } from '@/componentes/estado-vazio'
import { Dinheiro } from '@/componentes/dinheiro'
import { FormMaterial } from './form-material'
import { alternarAtivo } from './actions'

export const metadata: Metadata = { title: 'Materiais e preços' }

export default async function PaginaMateriais() {
  const usuario = await exigirPapel('administracao')
  const materiais = await listarMateriais(usuario.empresaId, { incluirInativos: true })

  return (
    <>
      <CabecalhoPagina pretitulo="Administração" titulo="Materiais e preços" />
      <CorpoPagina>
        <div className="card mb-3">
          <div className="card-header"><h2 className="card-title">Novo material</h2></div>
          <div className="card-body"><FormMaterial /></div>
        </div>

        {materiais.length === 0 ? (
          <EstadoVazio
            titulo="O catálogo nasce vazio"
            descricao="É tabela de preço, não estoque: não tem quantidade nem saldo. Cadastre o que a loja vende com mais frequência, com o preço e como ele é cobrado — por m², por unidade ou por metro linear. O formulário acima é o próximo passo. Sem catálogo o sistema funciona: o preço é digitado na hora, item por item."
          />
        ) : (
          <CartaoTabela
            rotulo="Materiais e preços"
            colunas={
              <>
                <th>Material</th>
                <th>Categoria</th>
                <th className="text-end">Preço</th>
                <th>Cobrado</th>
                <th className="w-1"></th>
              </>
            }
          >
            {materiais.map((m) => (
              <tr key={m.id} className={m.ativo ? '' : 'text-secondary'}>
                <td>
                  <Link href={`/materiais/${m.id}`} className="text-reset fw-medium">{m.nome}</Link>
                  {m.ativo ? null : <Selo tom="neutro" className="ms-2">inativo</Selo>}
                </td>
                <td>{m.categoria ?? ''}</td>
                <td className="numero"><Dinheiro valor={m.preco} /></td>
                <td>{rotuloUnidade(m.unidadeCobranca)}</td>
                <td>
                  <form action={alternarAtivo}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="ativo" value={m.ativo ? '0' : '1'} />
                    <button type="submit" className="btn btn-sm btn-ghost-secondary">{m.ativo ? 'Desativar' : 'Reativar'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </CartaoTabela>
        )}
      </CorpoPagina>
    </>
  )
}
