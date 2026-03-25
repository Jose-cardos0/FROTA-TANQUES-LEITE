import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { defaultHome } from '../components/RoleGate'
import { authErrorMessagePT } from '../utils/firebaseAuthErrors'
import AppLogo from '../components/AppLogo'

export default function Login() {
  const { login, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(defaultHome(profile.role), { replace: true })
    }
  }, [loading, user, profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (ex) {
      toast.error(authErrorMessagePT(ex))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="safe-pb flex min-h-[100dvh] min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <AppLogo imgClassName="mx-auto h-14 w-auto max-w-[220px] object-contain" />
        <h1 className="mt-4 text-center text-xl font-bold text-slate-900">Tanques Natville</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Pedidos de campo, frota de tanques, romaneios e baixas do eletricista — tudo num só sítio.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Palavra-passe</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <LogIn className="h-5 w-5" aria-hidden />
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
