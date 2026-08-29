import { formatarNumeroOs } from '@/domain/caixa/lancamento'

/**
 * O numero da ordem com os seis digitos, como a loja sempre escreveu: 018461.
 *
 * `formatarNumeroOs` ja existia, mas tres telas preferiram inlinar
 * `String(numero).padStart(6, '0')`. Quando o formato mudar, tem de mudar num
 * lugar so.
 */
export function NumeroOs({ numero }: { numero: number }) {
  return <>{formatarNumeroOs(numero)}</>
}
