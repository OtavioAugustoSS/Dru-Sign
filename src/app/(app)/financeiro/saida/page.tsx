import type { Metadata } from 'next'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { listarContas } from '@/infra/caixa/plano'
import { hojeCalendario } from '@/domain/ordem/datas'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { FormSaida } from './form-saida'

export const metadata: Metadata = { title: 'Nova saída' }

export default async function PaginaSaida() {
  const usuario = await exigirPapel('administracao')
  const contas = (await listarContas(usuario.empresaId)).filter((c) => c.tipo === 'despesa')
  return (
    <>
      <CabecalhoPagina voltar={{ href: '/financeiro', rotulo: 'Livro-caixa' }} titulo="Nova saída" />
      <CorpoPagina>
        {contas.length === 0 ? (
          <div className="alert alert-warning" role="alert">
            Nenhuma conta de despesa ativa. Cadastre uma no plano de contas antes de lançar saídas.
          </div>
        ) : null}
        <FormSaida hoje={hojeCalendario(new Date())} contas={contas.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, grupo: c.grupo }))} />
      </CorpoPagina>
    </>
  )
}
