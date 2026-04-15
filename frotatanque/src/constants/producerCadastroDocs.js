/** Chaves de categorias de ficheiros opcionais no cadastro de produtor (novo produtor via comprador). */
export const PRODUTOR_CADASTRO_DOC_KEYS = [
  'localizacaoTanque',
  'rgCpf',
  'itrSanitario',
  'acessibilidade',
]

export const PRODUTOR_CADASTRO_DOC_LABELS = {
  localizacaoTanque: 'Foto da localização onde vai ficar o tanque',
  rgCpf: 'Foto do RG e CPF (frente e verso)',
  itrSanitario: 'Foto do ITR e ficha sanitária',
  acessibilidade: 'Foto de acessibilidade',
}

/** Extensões e tipos MIME aceites para anexos de cadastro. */
export const PRODUTOR_CADASTRO_ACCEPT =
  'image/png,image/jpeg,image/jpg,application/pdf,.png,.jpg,.jpeg,.pdf'

export function emptyCadastroDocsState() {
  return {
    localizacaoTanque: [],
    rgCpf: [],
    itrSanitario: [],
    acessibilidade: [],
  }
}

export function isAllowedProducerCadastroFile(file) {
  if (!file || !file.name) return false
  const mime = String(file.type || '').toLowerCase()
  if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'application/pdf') return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'pdf'
}
