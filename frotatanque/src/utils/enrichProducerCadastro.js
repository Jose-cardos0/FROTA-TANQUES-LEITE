import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { uploadFile, producerCadastroDocStoragePath } from '../services/storage'
import { PRODUTOR_CADASTRO_DOC_KEYS } from '../constants/producerCadastroDocs'

/**
 * Anexa ficheiros e/ou texto opcional ao documento `produtores/{producerId}`.
 * Ficheiros são acrescentados aos arrays existentes em `cadastroDocs`.
 */
export async function enrichProducerCadastroFromComprador(producerId, { phone, bankDetailsText, filesByCategory }) {
  if (!producerId) return
  const pref = doc(db, 'produtores', producerId)
  const snap = await getDoc(pref)
  if (!snap.exists()) return

  const cur = snap.data()
  const cadastroDocs = { ...(cur.cadastroDocs || {}) }
  let uploadedAny = false

  for (const key of PRODUTOR_CADASTRO_DOC_KEYS) {
    const existing = Array.isArray(cadastroDocs[key]) ? [...cadastroDocs[key]] : []
    const files = (filesByCategory && filesByCategory[key]) || []
    if (files.length === 0) {
      cadastroDocs[key] = existing
      continue
    }
    for (const f of files) {
      const path = producerCadastroDocStoragePath(producerId, key, f)
      const url = await uploadFile(path, f)
      existing.push({
        url,
        fileName: f.name,
        contentType: f.type || null,
        uploadedAt: new Date().toISOString(),
      })
      uploadedAny = true
    }
    cadastroDocs[key] = existing
  }

  const phoneT = phone != null ? String(phone).trim() : ''
  const bankT = bankDetailsText != null ? String(bankDetailsText).trim() : ''

  if (!uploadedAny && !phoneT && !bankT) return

  const payload = { updatedAt: serverTimestamp() }
  if (uploadedAny) payload.cadastroDocs = cadastroDocs
  if (phoneT) payload.phone = phoneT
  if (bankT) payload.bankDetailsText = bankT

  await updateDoc(pref, payload)
}
