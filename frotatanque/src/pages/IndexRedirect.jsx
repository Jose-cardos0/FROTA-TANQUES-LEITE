import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { defaultHome } from '../components/RoleGate'

export default function IndexRedirect() {
  const { profile, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        A carregar…
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={defaultHome(profile.role)} replace />
}
