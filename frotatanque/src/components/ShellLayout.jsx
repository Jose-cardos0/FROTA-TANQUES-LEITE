import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Route,
  ClipboardCheck,
  UserCog,
  Briefcase,
  PlusCircle,
  UserPlus,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLES, ROLE_LABELS } from '../constants/roles'
import AppLogo from './AppLogo'
import GestorRomaneiosAtrasoBell from './GestorRomaneiosAtrasoBell'

const navGestor = [
  { to: '/gestor', end: true, label: 'Painel', icon: LayoutDashboard },
  { to: '/gestor/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/gestor/tanques', label: 'Tanques', icon: Package },
  { to: '/gestor/produtores', label: 'Produtores', icon: Users },
  { to: '/gestor/romaneio', label: 'Romaneio', icon: Route },
  { to: '/gestor/checklists', label: 'Checklists', icon: ClipboardCheck },
  { to: '/gestor/usuarios', label: 'Utilizadores', icon: UserCog },
]

const navEletricista = [
  { to: '/eletricista', end: true, label: 'Painel', icon: LayoutDashboard },
  { to: '/eletricista/romaneios', label: 'Romaneios', icon: ClipboardList },
  { to: '/eletricista/trabalhos', label: 'Trabalhos', icon: Briefcase },
]

const navComprador = [
  { to: '/comprador', end: true, label: 'Os meus pedidos', icon: ClipboardList },
  { to: '/comprador/novo', label: 'Novo pedido', icon: PlusCircle },
]

const navAdminGeral = [{ to: '/admin', end: true, label: 'Criar gestores', icon: UserPlus }]

function navForRole(role) {
  if (role === ROLES.ADMIN_GERAL) return navAdminGeral
  if (role === ROLES.GESTOR) return navGestor
  if (role === ROLES.ELETRICISTA) return navEletricista
  if (role === ROLES.COMPRADOR) return navComprador
  return []
}

const linkClass = ({ isActive }) =>
  `flex min-h-[44px] touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition active:opacity-90 ${
    isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-blue-50'
  }`

export default function ShellLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const items = navForRole(profile?.role)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  async function handleLogout() {
    setMobileOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  function NavBlock({ onItemClick }) {
    return (
      <>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onItemClick}
                className={linkClass}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-slate-100 p-3 safe-pb">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sair
          </button>
        </div>
      </>
    )
  }

  const userBlock = (
    <div className="border-b border-slate-100 px-4 py-4">
      <AppLogo imgClassName="mx-auto h-9 w-auto max-w-[180px] object-contain md:h-10 md:max-w-[200px]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Tanques Natville</p>
      <p className="mt-1 truncate text-sm font-medium">{profile?.displayName || profile?.email}</p>
      <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role] || ''}</p>
    </div>
  )

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm md:flex md:min-h-screen">
        {userBlock}
        <NavBlock />
      </aside>

      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src="/logonatville.webp"
            alt=""
            className="h-8 w-auto max-w-[120px] shrink-0 object-contain"
            width={120}
            height={32}
          />
          <span className="truncate text-sm font-semibold text-slate-800">Tanques Natville</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-slate-800 hover:bg-slate-100 active:bg-slate-200"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
          tabIndex={mobileOpen ? 0 : -1}
          aria-label="Fechar menu"
        />
        <aside
          className={`absolute bottom-0 left-0 top-0 flex w-[min(100vw-2.5rem,20rem)] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out safe-pb ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {userBlock}
          <NavBlock onItemClick={() => setMobileOpen(false)} />
        </aside>
      </div>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-6 pt-[4.5rem] safe-pb md:px-6 md:pb-8 md:pt-6 lg:px-8 lg:pt-8">
        <Outlet />
      </main>

      {profile?.role === ROLES.GESTOR ? <GestorRomaneiosAtrasoBell /> : null}
    </div>
  )
}
