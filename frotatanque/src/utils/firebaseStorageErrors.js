/**
 * Texto do erro incluindo corpo devolvido pelo Storage (JSON em string).
 * @param {unknown} error
 */
function storageErrorFullText(error) {
  const msg = String(error?.message || '')
  const sr =
    typeof error?.serverResponse === 'string'
      ? error.serverResponse
      : typeof error?.customData?.serverResponse === 'string'
        ? error.customData.serverResponse
        : ''
  return `${msg}\n${sr}`.toLowerCase()
}

function storageHttpStatusFromPayload(error) {
  const sr =
    typeof error?.serverResponse === 'string'
      ? error.serverResponse
      : typeof error?.customData?.serverResponse === 'string'
        ? error.customData.serverResponse
        : ''
  if (!sr.trim()) return null
  try {
    const j = JSON.parse(sr)
    const c = j?.error?.code
    return typeof c === 'number' ? c : null
  } catch {
    return null
  }
}

/**
 * Erro 412 no Firebase Storage: na prática quase sempre IAM / bucket ligado ao projeto,
 * não “ficheiro duplicado”. Ver https://firebase.google.com/support/faq#storage-accounts
 * @param {unknown} error
 */
function isStorage412ProjectMisconfig(error) {
  const httpStatus = typeof error?.status === 'number' ? error.status : null
  const fromBody = storageHttpStatusFromPayload(error)
  const full = storageErrorFullText(error)
  if (httpStatus === 412 || fromBody === 412) return true
  if (
    full.includes('service account') &&
    (full.includes('missing') || full.includes('permission') || full.includes('necessary'))
  ) {
    return true
  }
  if (full.includes('re-linking') || full.includes('relink')) return true
  if (full.includes('storage-accounts')) return true
  if (full.includes('addfirebase')) return true
  return false
}

/**
 * Mensagem legível para erros de upload Firebase Storage (incl. 412 / precondition).
 * @param {unknown} error
 */
export function storageErrorMessagePT(error) {
  const code = typeof error?.code === 'string' ? error.code : ''

  if (code === 'storage/canceled') {
    return 'Envio cancelado.'
  }
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return 'Sem permissão para enviar ficheiros. Inicie sessão novamente.'
  }
  if (code === 'storage/quota-exceeded') {
    return 'Espaço de armazenamento esgotado. Contacte o administrador.'
  }

  if (isStorage412ProjectMisconfig(error)) {
    return (
      'O Storage Firebase recusou o envio (erro 412). Isto costuma ser configuração do projeto Google/Firebase — por exemplo o bucket sem permissões da conta de serviço do Storage, ou faturação em falta. ' +
      'Abra a consola Firebase → Storage: se aparecer «Associar permissões» / «Attach permission», use essa opção. ' +
      'Guia oficial: firebase.google.com/support/faq#storage-accounts — ou peça ao administrador para rever IAM e faturação do projeto.'
    )
  }

  if (code && code.startsWith('storage/')) {
    return 'Erro ao enviar ficheiros. Verifique a ligação e tente novamente.'
  }
  return 'Erro ao guardar.'
}
