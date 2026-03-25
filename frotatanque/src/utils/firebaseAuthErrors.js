/**
 * Converte erros do Firebase Authentication em mensagens claras em português.
 * @param {unknown} error - Objeto de erro do Firebase (tem .code) ou Error genérico
 * @param {string} [fallback] - Mensagem se o código for desconhecido
 */
export function authErrorMessagePT(error, fallback = 'Não foi possível concluir a operação. Tente novamente.') {
  const code =
    typeof error?.code === 'string'
      ? error.code
      : typeof error === 'string'
        ? error
        : null

  const messages = {
    // Registo / email
    'auth/email-already-in-use':
      'Este email já está a ser utilizado. Escolha outro email ou peça a essa pessoa para iniciar sessão.',
    'auth/email-already-exists': 'Já existe uma conta com este email.',
    'auth/invalid-email': 'O email indicado não é válido. Verifique e tente de novo.',
    'auth/missing-email': 'Indique um email.',

    // Palavra-passe
    'auth/weak-password': 'A palavra-passe é demasiado fraca. Use pelo menos 6 caracteres ou combine letras e números.',
    'auth/wrong-password': 'Palavra-passe incorreta.',
    'auth/invalid-password': 'Palavra-passe inválida.',
    'auth/credential-too-old-login-again': 'Por segurança, termine sessão e volte a entrar para continuar.',

    // Login
    'auth/user-not-found': 'Não encontrámos uma conta com este email. Verifique o email ou registe-se.',
    'auth/invalid-credential': 'Email ou palavra-passe incorretos. Verifique os dados.',
    'auth/user-disabled': 'Esta conta foi desativada. Contacte o administrador.',

    // Limites e rede
    'auth/too-many-requests': 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Sem ligação à internet ou o servidor não respondeu. Verifique a rede.',

    // Configuração / técnico
    'auth/operation-not-allowed': 'Este método de início de sessão não está ativo no projeto. Contacte o suporte técnico.',
    'auth/invalid-api-key': 'Erro de configuração da aplicação. Contacte o suporte técnico.',
    'auth/app-deleted': 'Erro de configuração. Contacte o suporte técnico.',
    'auth/invalid-user-token': 'Sessão inválida. Termine sessão e entre novamente.',
    'auth/user-token-expired': 'A sessão expirou. Inicie sessão novamente.',

    // Conta / credenciais
    'auth/account-exists-with-different-credential':
      'Já existe uma conta com este email com outro método de início de sessão.',
    'auth/requires-recent-login': 'Por segurança, termine sessão e volte a entrar antes de continuar.',

    'auth/internal-error': 'Erro interno do serviço. Tente mais tarde.',
  }

  if (code && messages[code]) {
    return messages[code]
  }

  return fallback
}
