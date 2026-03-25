/** Conta manual em Firebase Auth; perfil em Firestore com role admin_geral */
export const ADMIN_NATVILLE_EMAIL = 'admin@natville.com'

export const ROLES = {
  ADMIN_GERAL: 'admin_geral',
  GESTOR: 'gestor',
  ELETRICISTA: 'eletricista',
  COMPRADOR: 'comprador',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN_GERAL]: 'Administrador geral Natville',
  [ROLES.GESTOR]: 'Gestor',
  [ROLES.ELETRICISTA]: 'Eletricista',
  [ROLES.COMPRADOR]: 'Comprador de leite',
}

export const PEDIDO_TIPO = {
  INSTALACAO: 'instalacao',
  TROCA: 'troca',
  REMOCAO: 'remocao',
  MANUTENCAO: 'manutencao',
}

export const PEDIDO_STATUS = {
  ABERTO: 'aberto',
  VINCULADO: 'vinculado_tanque',
  EM_ROMANEIO: 'em_romaneio',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
}

/** Rótulos para UI (comprador, gestor, relatórios). */
export const PEDIDO_TIPO_LABELS = {
  [PEDIDO_TIPO.INSTALACAO]: 'Instalação',
  [PEDIDO_TIPO.TROCA]: 'Troca',
  [PEDIDO_TIPO.REMOCAO]: 'Remoção',
  [PEDIDO_TIPO.MANUTENCAO]: 'Manutenção',
}

export const PEDIDO_STATUS_LABELS = {
  [PEDIDO_STATUS.ABERTO]: 'Aberto',
  [PEDIDO_STATUS.VINCULADO]: 'Tanque vinculado',
  [PEDIDO_STATUS.EM_ROMANEIO]: 'Em romaneio',
  [PEDIDO_STATUS.CONCLUIDO]: 'Concluído',
  [PEDIDO_STATUS.CANCELADO]: 'Recusado',
}

export const ROMANEIO_STATUS = {
  PLANEJADO: 'planejado',
  EM_ANDAMENTO: 'em_andamento',
  ATRASADO: 'atrasado',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
}

export const ITEM_ROMANEIO_STATUS = {
  PENDENTE: 'pendente',
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDO: 'concluido',
  INCOMPLETO_REAGENDAR: 'incompleto_reagendar',
  CANCELADO: 'cancelado',
}

export const ROMANEIO_STATUS_LABELS = {
  [ROMANEIO_STATUS.PLANEJADO]: 'Planeado',
  [ROMANEIO_STATUS.EM_ANDAMENTO]: 'Em andamento',
  [ROMANEIO_STATUS.ATRASADO]: 'Atrasado',
  [ROMANEIO_STATUS.CONCLUIDO]: 'Concluído',
  [ROMANEIO_STATUS.CANCELADO]: 'Cancelado',
}

export const ITEM_ROMANEIO_STATUS_LABELS = {
  [ITEM_ROMANEIO_STATUS.PENDENTE]: 'Pendente',
  [ITEM_ROMANEIO_STATUS.EM_ANDAMENTO]: 'Em andamento',
  [ITEM_ROMANEIO_STATUS.CONCLUIDO]: 'Concluído',
  [ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR]: 'Incompleto — reagendar',
  [ITEM_ROMANEIO_STATUS.CANCELADO]: 'Cancelado',
}
