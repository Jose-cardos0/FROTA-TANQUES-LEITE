import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'

export function defaultHome(role) {
  if (role === ROLES.ADMIN_GERAL) return '/admin'
  if (role === ROLES.GESTOR) return '/gestor'
  if (role === ROLES.ELETRICISTA) return '/eletricista'
  if (role === ROLES.COMPRADOR) return '/comprador'
  return '/login'
}

export default function RoleGate({ roles }) {
  const { profile } = useAuth()
  if (!profile) {
    return <Navigate to="/login" replace />
  }
  if (!roles.includes(profile.role)) {
    return <Navigate to={defaultHome(profile.role)} replace />
  }
  return <Outlet />
}
