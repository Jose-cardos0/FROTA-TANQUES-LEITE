/**
 * Mensagens em português para erros comuns do cliente Firestore.
 */
export function firestoreErrorMessagePT(error, fallback = 'Não foi possível concluir a operação.') {
  const code = error?.code
  const map = {
    'permission-denied':
      'Não tem permissão para esta ação. Verifique as regras de segurança do Firestore.',
    'not-found': 'O documento já não existe ou foi removido.',
    'unavailable': 'Serviço temporariamente indisponível. Tente dentro de momentos.',
    'failed-precondition': 'A operação não pode ser feita neste estado.',
  }
  if (code && map[code]) return map[code]
  return fallback
}
