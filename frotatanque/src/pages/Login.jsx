import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Download, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { defaultHome } from '../components/RoleGate'
import { authErrorMessagePT } from '../utils/firebaseAuthErrors'
import AppLogo from '../components/AppLogo'

const RESET_SUCCESS_MSG =
  'Se existir uma conta com este email, receberá instruções para repor a palavra-passe. Verifique a caixa de entrada e o spam.'

export default function Login() {
  const { login, sendPasswordReset, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [pwaInstalled, setPwaInstalled] = useState(false)

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(defaultHome(profile.role), { replace: true })
    }
  }, [loading, user, profile, navigate])

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true
    if (standalone) setPwaInstalled(true)

    function onBeforeInstallPrompt(e) {
      e.preventDefault()
      setInstallPromptEvent(e)
    }
    function onAppInstalled() {
      setPwaInstalled(true)
      setInstallPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  function isIosNotStandalone() {
    const ua = window.navigator.userAgent
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    return iOS && !window.navigator.standalone
  }

  async function handleInstallPwa() {
    if (pwaInstalled) return
    if (isIosNotStandalone()) {
      toast.info(
        'No iPhone/iPad: toque em Partilhar (□↑) e escolha «Adicionar ao ecrã principal».',
        { autoClose: 9000 },
      )
      return
    }
    if (installPromptEvent) {
      installPromptEvent.prompt()
      await installPromptEvent.userChoice
      setInstallPromptEvent(null)
      return
    }
    toast.info(
      'Procure «Instalar app» ou o ícone de instalação na barra do browser (Chrome/Edge). Em alguns dispositivos a opção só aparece após usar o site algumas vezes.',
      { autoClose: 9000 },
    )
  }

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

  async function handlePasswordReset(e) {
    e.preventDefault()
    const em = email.trim()
    if (!em) {
      toast.error('Indique o email da sua conta.')
      return
    }
    setResetSubmitting(true)
    try {
      await sendPasswordReset(em)
      toast.success(RESET_SUCCESS_MSG)
      setForgotOpen(false)
    } catch (ex) {
      if (ex?.code === 'auth/user-not-found') {
        toast.success(RESET_SUCCESS_MSG)
        setForgotOpen(false)
      } else {
        toast.error(authErrorMessagePT(ex))
      }
    } finally {
      setResetSubmitting(false)
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

        {forgotOpen ? (
          <form onSubmit={handlePasswordReset} className="mt-8 space-y-4">
            <p className="text-sm text-slate-600">
              Indique o email da conta. Enviaremos um link para definir uma nova palavra-passe (se a conta existir).
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={resetSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {resetSubmitting ? 'A enviar…' : 'Enviar email de recuperação'}
            </button>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Voltar ao início de sessão
            </button>
          </form>
        ) : (
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
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Palavra-passe</label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                >
                  Esqueceu-se da palavra-passe?
                </button>
              </div>
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
        )}

        {!pwaInstalled ? (
          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              onClick={handleInstallPwa}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <Download className="h-3.5 w-3.5 opacity-70" strokeWidth={2} aria-hidden />
              Instalar como app no telemóvel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
