import { readFileSync } from 'node:fs'

export interface CampoDbf {
  nome: string
  tipo: string
  tamanho: number
  decimais: number
}

export interface RegistroDbf {
  /** Flag '*' do dBase: o registro foi apagado logicamente. O legado tem 1.978 destes em CLIENTES. */
  apagado: boolean
  valores: Record<string, string | number | null>
}

export interface ArquivoDbf {
  campos: CampoDbf[]
  registros: RegistroDbf[]
}

/** Leitor dBase III/xHarbour sem dependencia: cabecalho de 32 bytes, descritores de 32, terminador 0x0D. */
export function interpretarDbf(buf: Buffer, codificacao = 'windows-1252'): ArquivoDbf {
  const nRegistros = buf.readUInt32LE(4)
  const tamCabecalho = buf.readUInt16LE(8)
  const tamRegistro = buf.readUInt16LE(10)

  const campos: CampoDbf[] = []
  let pos = 32
  while (pos + 32 <= buf.length && buf[pos] !== 0x0d && buf[pos] !== 0x00) {
    const d = buf.subarray(pos, pos + 32)
    const nome = d.subarray(0, 11).toString('ascii').split('\0')[0]?.trim() ?? ''
    campos.push({ nome, tipo: String.fromCharCode(d[11] ?? 0), tamanho: d[16] ?? 0, decimais: d[17] ?? 0 })
    pos += 32
  }

  const decoder = new TextDecoder(codificacao)
  const registros: RegistroDbf[] = []
  let inicio = tamCabecalho
  for (let i = 0; i < nRegistros && inicio + tamRegistro <= buf.length; i++, inicio += tamRegistro) {
    const bruto = buf.subarray(inicio, inicio + tamRegistro)
    const valores: Record<string, string | number | null> = {}
    let p = 1
    for (const c of campos) {
      const pedaco = bruto.subarray(p, p + c.tamanho)
      p += c.tamanho
      if (c.tipo === 'N' || c.tipo === 'F') {
        const txt = pedaco.toString('ascii').trim()
        valores[c.nome] = txt === '' ? null : Number(txt)
      } else if (c.tipo === 'L') {
        const ch = pedaco.toString('ascii')
        valores[c.nome] = /[TtYy]/.test(ch) ? 'T' : /[FfNn]/.test(ch) ? 'F' : null
      } else {
        valores[c.nome] = decoder.decode(pedaco).trim()
      }
    }
    registros.push({ apagado: bruto[0] === 0x2a, valores })
  }
  return { campos, registros }
}

export function lerDbf(caminho: string, codificacao = 'windows-1252'): ArquivoDbf {
  return interpretarDbf(readFileSync(caminho), codificacao)
}
