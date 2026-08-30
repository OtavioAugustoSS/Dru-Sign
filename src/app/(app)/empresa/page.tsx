import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirPapel } from '@/infra/auth/usuario-atual'
import { obterEmpresa } from '@/infra/empresa/repositorio'
import { CabecalhoPagina } from '@/componentes/cabecalho-pagina'
import { CorpoPagina } from '@/componentes/corpo-pagina'
import { FormEmpresa } from './form-empresa'

export const metadata: Metadata = { title: 'Dados da empresa' }

export default async function PaginaEmpresa() {
  const usuario = await exigirPapel('administracao')
  const empresa = await obterEmpresa(usuario.empresaId)
  return (
    <>
      <CabecalhoPagina pretitulo="Configuração" titulo="Dados da empresa" />
      <CorpoPagina>
        <FormEmpresa empresa={empresa} />
        {/* O link dizia "Imprimir" e levava para a lista de ordens: o texto
            prometia uma acao e o destino era outro lugar. Agora o texto diz para
            onde vai, e a instrucao de imprimir fica em palavras. */}
        <p className="text-secondary small mt-2">
          O logo entra junto com o anexo de arte, na próxima fase. Para conferir como ficou o cabeçalho,
          abra uma ordem em <Link href="/ordens">Ordens</Link> e clique em “Imprimir”.
        </p>
      </CorpoPagina>
    </>
  )
}
