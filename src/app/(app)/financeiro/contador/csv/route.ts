import { exigirPapel } from '@/infra/auth/usuario-atual'
import { montarRelatorio } from '@/infra/caixa/relatorio'
import { paraCsv } from '@/domain/caixa/relatorio'
import { mesCalendario } from '@/domain/ordem/datas'
import { ErroDeValidacao } from '@/domain/precificacao/erros'

export async function GET(requisicao: Request): Promise<Response> {
  const usuario = await exigirPapel('administracao')
  const url = new URL(requisicao.url)
  const mes = mesCalendario(new Date())
  const periodo = { de: url.searchParams.get('de') ?? mes.de, ate: url.searchParams.get('ate') ?? mes.ate }
  try {
    const relatorio = await montarRelatorio(usuario.empresaId, periodo)
    // BOM: sem ele o Excel em portugues abre "MANUTENÇÃO" como "MANUTENÃÃO".
    const corpo = `﻿${paraCsv(relatorio, periodo)}`
    return new Response(corpo, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="caixa-${periodo.de}-a-${periodo.ate}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof ErroDeValidacao) return new Response(e.message, { status: 400 })
    throw e
  }
}
