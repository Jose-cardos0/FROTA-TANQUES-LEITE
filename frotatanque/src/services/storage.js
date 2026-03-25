import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

export async function uploadFile(path, file) {
  const r = ref(storage, path)
  await uploadBytes(r, file)
  return getDownloadURL(r)
}
