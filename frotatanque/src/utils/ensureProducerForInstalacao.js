import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Instalação sem produtor selecionado no cadastro: reutiliza documento com o mesmo nome+região (normalizado) ou cria em `produtores`.
 * @param {{ produtores: Array<{ id: string, name?: string, region?: string }>, producerName: string, region: string, address: string, createdByUserId: string }} p
 * @returns {Promise<string>} id do produtor em `produtores`
 */
export async function ensureProducerForTypedInstalacao({
  produtores,
  producerName,
  region,
  address,
  createdByUserId,
}) {
  const nameT = producerName.trim()
  const regionT = region.trim()
  if (!nameT || !regionT || !createdByUserId) {
    throw new Error('ensureProducerForTypedInstalacao: nome, região e utilizador são obrigatórios.')
  }

  const n = norm(nameT)
  const r = norm(regionT)
  const existing = produtores.find((p) => norm(p.name) === n && norm(p.region) === r)
  if (existing) return existing.id

  const ref = await addDoc(collection(db, 'produtores'), {
    name: nameT,
    region: regionT,
    phone: null,
    address: address.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: createdByUserId,
    source: 'comprador_instalacao',
  })
  return ref.id
}
