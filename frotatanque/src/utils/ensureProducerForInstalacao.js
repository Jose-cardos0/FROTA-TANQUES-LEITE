import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Sem produtor no cadastro (instalação ou remoção com nome escrito): reutiliza documento com o mesmo nome+região (normalizado) ou cria em `produtores`.
 * @param {{ produtores: Array<{ id: string, name?: string, region?: string }>, producerName: string, region: string, address: string, createdByUserId: string, source?: string }} p
 * @returns {Promise<string>} id do produtor em `produtores`
 */
export async function ensureProducerForTypedInstalacao({
  produtores,
  producerName,
  region,
  address,
  createdByUserId,
  source = 'comprador_instalacao',
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
    source,
  })
  return ref.id
}
