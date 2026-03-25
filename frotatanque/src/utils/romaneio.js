import { ITEM_ROMANEIO_STATUS, ROMANEIO_STATUS } from '../constants/roles'

/** Estados em que o pedido já saiu da fila ativa do romaneio (baixa dada). */
const TERMINAL = [
  ITEM_ROMANEIO_STATUS.CONCLUIDO,
  ITEM_ROMANEIO_STATUS.CANCELADO,
  ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR,
]

/**
 * @returns {{ total: number, feitos: number, concluidosInstalacao: number }}
 */
export function romaneioProgress(itens) {
  const list = itens || []
  const total = list.length
  const feitos = list.filter((i) => TERMINAL.includes(i.status)).length
  const concluidosInstalacao = list.filter((i) => i.status === ITEM_ROMANEIO_STATUS.CONCLUIDO).length
  return { total, feitos, concluidosInstalacao }
}

/** Estado agregado do documento `romaneios` consoante os itens (igual ao fluxo do eletricista). */
export function computeRomaneioStatus(itens) {
  const all = itens || []
  if (all.length === 0) return ROMANEIO_STATUS.PLANEJADO
  const open = all.filter((i) =>
    [ITEM_ROMANEIO_STATUS.PENDENTE, ITEM_ROMANEIO_STATUS.EM_ANDAMENTO].includes(i.status),
  )
  if (open.length) return ROMANEIO_STATUS.EM_ANDAMENTO
  const anyReag = all.some((i) => i.status === ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR)
  if (anyReag) return ROMANEIO_STATUS.EM_ANDAMENTO
  return ROMANEIO_STATUS.CONCLUIDO
}
