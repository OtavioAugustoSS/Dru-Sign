/** Sem "Avista": era o valor de fabrica em 98,5% dos titulos do legado e nao significa nada (spec, secao 7). */
export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'boleto'] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de débito',
  cartao_credito: 'Cartão de crédito',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  boleto: 'Boleto',
}

export function ehFormaPagamento(v: string): v is FormaPagamento {
  return (FORMAS_PAGAMENTO as readonly string[]).includes(v)
}
