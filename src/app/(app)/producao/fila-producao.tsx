import Link from 'next/link'
import { TEXTO_URGENCIA } from '@/componentes/selo'
import { formatarNumeroOs } from '@/domain/caixa/lancamento'
import { formatarDataCalendario, formatarDataLonga } from '@/domain/ordem/datas'
import { ROTULO_URGENCIA, type FilaProducao, type OrdemDaProducao } from '@/domain/producao/urgencia'
import { BotaoFinalizado } from './botao-finalizado'


/** Densidade baixa, tipo grande, botao de 56px: lida de longe, tocada de pe (spec, tela 8). */
export function FilaDeProducao({ fila }: { fila: FilaProducao }) {
  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Produção</div>
              <h2 className="page-title fs-1">Fila de produção</h2>
            </div>
            <div className="col-auto fs-3">
              {fila.total === 0 ? null : <>{fila.total} em produção{fila.atrasadas > 0 ? <span className="text-danger ms-2">· {fila.atrasadas} atrasada{fila.atrasadas > 1 ? 's' : ''}</span> : null}</>}
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="container-xl">
          {fila.total === 0 ? (
            <div className="card"><div className="card-body"><div className="empty">
              <p className="empty-title fs-2">Nada na fila</p>
              <p className="empty-subtitle fs-3 text-secondary">Todo serviço aberto já foi finalizado. Quando o atendimento abrir uma ordem, ela aparece aqui.</p>
            </div></div></div>
          ) : fila.grupos.map((g) => (
            <section key={g.grupo} className="mb-4">
              <h3 className={`fs-2 mb-3 ${TEXTO_URGENCIA[g.grupo]}`}>{ROTULO_URGENCIA[g.grupo]} <span className="text-secondary">({g.ordens.length})</span></h3>
              <div className="row g-3">
                {g.ordens.map((o) => <Cartao key={o.id} ordem={o} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

function Cartao({ ordem }: { ordem: OrdemDaProducao }) {
  return (
    <div className="col-12 col-xl-6">
      <div className="card h-100">
        <div className="card-body">
          <div className="d-flex align-items-baseline justify-content-between mb-2">
            <Link href={`/ordens/${ordem.id}`} className="text-reset fs-1 fw-bold numero">{formatarNumeroOs(ordem.numero)}</Link>
            <div className="fs-3 text-end">
              {ordem.prometidaPara
                ? <>Entrega {formatarDataLonga(new Date(ordem.prometidaPara))}<div className="text-secondary fs-4">{formatarDataCalendario(new Date(ordem.prometidaPara))}</div></>
                : <span className="text-secondary">Sem data combinada</span>}
            </div>
          </div>
          <div className="fs-2 mb-2">{ordem.clienteApelido ?? ordem.clienteNome ?? <span className="text-secondary">Venda de balcão</span>}</div>
          <ul className="fs-3 mb-3 ps-3">
            {ordem.itens.length === 0 ? <li className="text-secondary">Sem itens lançados</li> : ordem.itens.map((i, n) => <li key={`${ordem.id}-${n}`}>{i}</li>)}
          </ul>
          <BotaoFinalizado ordemId={ordem.id} versao={ordem.versao} />
        </div>
      </div>
    </div>
  )
}
