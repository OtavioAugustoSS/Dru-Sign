import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterFamilia, simular } from '@/infra/precificacao/repositorio'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { EditorFamilia, type LinhaMaterial } from '../editor-familia'

export const metadata: Metadata = { title: 'Ajustar preços' }

export default async function PaginaFamilia({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPapel('administracao')
  const { id } = await params
  const familia = await obterFamilia(usuario.empresaId, id)
  if (!familia) notFound()

  // Simula com os parametros em vigor: a tela abre mostrando os precos de hoje, e o
  // simulador do cliente recalcula dali em diante.
  const atual = await simular(usuario.empresaId, id, {
    margem: familia.margem,
    arredondamento: familia.arredondamento,
  })

  // Decimal nao atravessa a fronteira servidor -> cliente; vai como string exata.
  const linhas: LinhaMaterial[] = atual.linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    custo: l.custo === null ? null : l.custo.toFixed(),
    precoAtual: l.precoAtual.toFixed(),
    travado: l.motivo === 'travado',
  }))

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/precificacao', rotulo: 'Precificação' }}
        titulo={familia.nome}
        descricao="Mexa nos números e veja o que aconteceria com os preços antes de aplicar."
      />
      <CorpoPagina>
        <EditorFamilia
          id={familia.id}
          nome={familia.nome}
          margem={familia.margem.toFixed(2).replace('.', ',')}
          arredondamento={familia.arredondamento.toFixed(2)}
          minimoCobranca={familia.minimoCobranca === null ? '' : familia.minimoCobranca.toFixed(2).replace('.', ',')}
          linhas={linhas}
        />
      </CorpoPagina>
    </>
  )
}
