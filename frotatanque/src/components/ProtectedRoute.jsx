import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        A carregar…
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
