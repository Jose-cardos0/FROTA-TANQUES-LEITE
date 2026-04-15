import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

/** Nome seguro para o path (evita /, #, ?, espaços estranhos no GCS). */
export function sanitizeStorageFileName(name) {
  const base = String(name || 'foto').split(/[/\\]/).pop() || 'foto'
  const cleaned = base.replace(/[^\w.\-()+]/g, '_').replace(/_+/g, '_').trim()
  const sliced = cleaned.slice(0, 100)
  return sliced || 'foto'
}

function newUploadId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

/**
 * Path único por upload — evita HTTP 412 (precondition: objeto já existia neste caminho).
 */
export function romaneioFotoStoragePath(romaneioId, itemId, index, file) {
  const safe = sanitizeStorageFileName(file?.name)
  return `romaneios/${romaneioId}/${itemId}/${newUploadId()}_${Date.now()}_${index}_${safe}`
}

export function producerCadastroDocStoragePath(producerId, categoriaKey, file) {
  const safe = sanitizeStorageFileName(file?.name)
  return `produtores/${producerId}/cadastro/${categoriaKey}/${newUploadId()}_${Date.now()}_${safe}`
}

export async function uploadFile(path, file) {
  const r = ref(storage, path)
  const metadata =
    file?.type && String(file.type).trim() ? { contentType: file.type.trim() } : {}
  await uploadBytes(r, file, metadata)
  return getDownloadURL(r)
}
