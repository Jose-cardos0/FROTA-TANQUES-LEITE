import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { PEDIDO_STATUS, ITEM_ROMANEIO_STATUS } from '../constants/roles'

export const TANQUE_HIST_TIPO = {
  VINCULO_ROMANEIO: 'vinculo_romaneio',
  ENTREGA_ELETRICISTA: 'eletricista_entrega',
  DESVINCULO_ITEM_ROMANEIO: 'desvinculo_item_romaneio',
  DESVINCULO_ROMANEIO_APAGADO: 'desvinculo_romaneio_eliminado',
  DESVINCULO_PEDIDO_APAGADO: 'desvinculo_pedido_eliminado',
  VINCULO_MANUAL_GESTOR: 'vinculo_manual_gestor',
  DESVINCULO_MANUAL_GESTOR: 'desvinculo_manual_gestor',
  MANUTENCAO_ENTRADA: 'manutencao_entrada',
  MANUTENCAO_SAIDA: 'manutencao_saida',
}

/**
 * @param {object|null} ped
 * @param {{ id: string, name?: string, region?: string }[]} produtoresList
 */
export function resolveProducerIdFromPedido(ped, produtoresList) {
  if (!ped) return null
  if (ped.producerId) return ped.producerId
  const name = (ped.producerName || '').trim().toLowerCase()
  if (!name) return null
  const region = (ped.region || '').trim().toLowerCase()
  const matches = produtoresList.filter(
    (pr) => (String(pr.name || '').trim().toLowerCase() === name),
  )
  if (matches.length === 1) return matches[0].id
  if (region && matches.length > 1) {
    const r = matches.find((pr) => (String(pr.region || '').trim().toLowerCase() === region))
    if (r) return r.id
  }
  return matches[0]?.id ?? null
}

export async function fetchUserDisplayName(userId) {
  if (!userId) return ''
  const s = await getDoc(doc(db, 'users', userId))
  if (!s.exists()) return ''
  const d = s.data()
  return d.displayName || d.email || ''
}

export async function appendTanqueHistorico(tanqueId, payload) {
  if (!tanqueId) return
  await addDoc(collection(db, 'tanques', tanqueId, 'historico'), {
    ...payload,
    createdAt: serverTimestamp(),
  })
}

/**
 * Ao criar romaneio: associa tanque ao produtor (se resolvido), pedido ao tanque, regista histórico.
 */
export async function bindTanqueViaRomaneio({
  tanqueId,
  producerId,
  pedidoId,
  romaneioId,
  romaneioTitulo,
  producerName,
  compradorNome,
  tipoPedidoLabel,
  motivoSolicitacao,
  recolherTanque,
}) {
  if (!tanqueId) return
  const tRef = doc(db, 'tanques', tanqueId)
  const texto = [
    `Entrada na rota — romaneio «${romaneioTitulo || romaneioId}».`,
    producerName && `Produtor: ${producerName}`,
    tipoPedidoLabel && `Tipo de serviço: ${tipoPedidoLabel}`,
    motivoSolicitacao && `Solicitação do comprador: ${motivoSolicitacao}`,
    compradorNome && `Comprador: ${compradorNome}`,
    recolherTanque ? 'RECOLHER — recolha do tanque na propriedade e devolução à Natville.' : '',
  ]
    .filter(Boolean)
    .join('\n')

  await updateDoc(tRef, {
    producerId: producerId || null,
    status: producerId ? 'em_uso' : 'disponivel',
    vinculadoAoProdutorEm: producerId ? serverTimestamp() : null,
    pedidoOrigemId: pedidoId || null,
    vinculoRomaneioId: romaneioId || null,
    updatedAt: serverTimestamp(),
  })

  await appendTanqueHistorico(tanqueId, {
    texto,
    tipo: TANQUE_HIST_TIPO.VINCULO_ROMANEIO,
    pedidoId: pedidoId || null,
    romaneioId: romaneioId || null,
    producerId: producerId || null,
    producerName: producerName || null,
    compradorNome: compradorNome || null,
    tipoPedidoLabel: tipoPedidoLabel || null,
    motivoSolicitacao: motivoSolicitacao || null,
    ...(recolherTanque ? { recolherTanque: true } : {}),
  })
}

/**
 * Desfaz vínculo físico (tanque deixa o produtor) quando o trabalho do romaneio não estava concluído.
 */
export async function revertTanqueRomaneioPendente({
  tanqueId,
  pedidoId,
  romaneioId,
  romaneioTitulo,
  motivo,
  pedidoStatus,
  itemStatus,
  producerName = '',
}) {
  if (!tanqueId) return
  if (pedidoStatus === PEDIDO_STATUS.CONCLUIDO) return
  if (itemStatus === ITEM_ROMANEIO_STATUS.CONCLUIDO) return

  const tRef = doc(db, 'tanques', tanqueId)
  const ts = await getDoc(tRef)
  if (!ts.exists()) return

  const tipoHist =
    motivo === 'item_removido'
      ? TANQUE_HIST_TIPO.DESVINCULO_ITEM_ROMANEIO
      : motivo === 'romaneio_eliminado'
        ? TANQUE_HIST_TIPO.DESVINCULO_ROMANEIO_APAGADO
        : motivo === 'pedido_recusado'
          ? TANQUE_HIST_TIPO.DESVINCULO_PEDIDO_APAGADO
        : TANQUE_HIST_TIPO.DESVINCULO_PEDIDO_APAGADO

  const motivoTxt =
    motivo === 'item_removido'
      ? 'Linha removida da lista de romaneio'
      : motivo === 'romaneio_eliminado'
        ? 'Romaneio eliminado pelo gestor'
        : motivo === 'pedido_recusado'
          ? 'Pedido recusado pelo gestor'
        : 'Pedido eliminado pelo gestor'

  const texto = [
    `Desvinculação registada — ${motivoTxt}.`,
    producerName && `Produtor: ${producerName}`,
    romaneioTitulo && `Romaneio: ${romaneioTitulo}`,
    pedidoId && `Pedido: ${pedidoId.slice(0, 8)}…`,
  ]
    .filter(Boolean)
    .join('\n')

  await appendTanqueHistorico(tanqueId, {
    texto,
    tipo: tipoHist,
    pedidoId: pedidoId || null,
    romaneioId: romaneioId || null,
  })

  await updateDoc(tRef, {
    producerId: null,
    status: 'disponivel',
    vinculadoAoProdutorEm: null,
    pedidoOrigemId: null,
    vinculoRomaneioId: null,
    updatedAt: serverTimestamp(),
  })
}

export async function appendManualVinculoHistorico(tanqueId, { texto, tipo, producerNameAntes, producerNameDepois }) {
  await appendTanqueHistorico(tanqueId, {
    texto,
    tipo,
    producerNameAntes: producerNameAntes || null,
    producerNameDepois: producerNameDepois || null,
  })
}
