'use client'
import { SALVANDO } from '@/componentes/rotulos'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatarTelefone } from '@/domain/clientes/telefone'
import { formatarDocumento } from '@/domain/clientes/documento'
import type { EmpresaTela } from '@/infra/empresa/repositorio'
import { salvarEmpresaAction } from './actions'

type Campos = Record<keyof EmpresaTela, string>

function paraFormulario(e: EmpresaTela): Campos {
  return {
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia ?? '',
    cnpj: e.cnpj ? formatarDocumento(e.cnpj) : '',
    endereco: e.endereco ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    uf: e.uf ?? '',
    cep: e.cep ?? '',
    telefone1: e.telefone1 ? formatarTelefone(e.telefone1) : '',
    telefone2: e.telefone2 ? formatarTelefone(e.telefone2) : '',
  }
}

export function FormEmpresa({ empresa }: { empresa: EmpresaTela }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [resposta, setResposta] = useState<'nenhuma' | 'salvo' | string>('nenhuma')
  const [campos, setCampos] = useState<Campos>(paraFormulario(empresa))
  const em = (k: keyof Campos) => ({ value: campos[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [k]: e.target.value })) })

  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault()
      if (pendente) return
      iniciar(async () => {
        const r = await salvarEmpresaAction(campos)
        setResposta(r.ok ? 'salvo' : r.erro)
        if (r.ok) iniciar(() => router.refresh())
      })
    }}>
      <div className="card-body row g-3">
        <div className="col-md-6"><label className="form-label" htmlFor="razaoSocial">Razão social</label><input id="razaoSocial" className="form-control" {...em('razaoSocial')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="nomeFantasia">Nome fantasia</label><input id="nomeFantasia" className="form-control" {...em('nomeFantasia')} placeholder="DruSign" /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="cnpj">CNPJ</label><input id="cnpj" className="form-control numero" inputMode="numeric" {...em('cnpj')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="telefone1">Telefone</label><input id="telefone1" className="form-control numero" inputMode="tel" {...em('telefone1')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="telefone2">Outro telefone</label><input id="telefone2" className="form-control numero" inputMode="tel" {...em('telefone2')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="endereco">Endereço</label><input id="endereco" className="form-control" {...em('endereco')} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="bairro">Bairro</label><input id="bairro" className="form-control" {...em('bairro')} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="cep">CEP</label><input id="cep" className="form-control numero" inputMode="numeric" {...em('cep')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="cidade">Cidade</label><input id="cidade" className="form-control" {...em('cidade')} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="uf">UF</label><input id="uf" className="form-control" maxLength={2} {...em('uf')} /></div>
        <div className="col-12 form-hint">É o que sai no cabeçalho do impresso da ordem. O que ficar em branco simplesmente não aparece lá.</div>
      </div>
      <div className="card-footer d-flex align-items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pendente}>{pendente ? SALVANDO : 'Salvar'}</button>
        {resposta === 'salvo' ? <span className="text-success small" role="status">Salvo.</span> : null}
        {resposta !== 'salvo' && resposta !== 'nenhuma' ? <span className="text-danger small" role="alert">{resposta}</span> : null}
      </div>
    </form>
  )
}
