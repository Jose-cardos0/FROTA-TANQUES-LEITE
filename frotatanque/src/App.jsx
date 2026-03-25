import { Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ShellLayout from './components/ShellLayout'
import RoleGate from './components/RoleGate'
import { ROLES } from './constants/roles'

import Login from './pages/Login'
import IndexRedirect from './pages/IndexRedirect'

import GestorDashboard from './pages/gestor/GestorDashboard'
import GestorPedidos from './pages/gestor/GestorPedidos'
import GestorTanques from './pages/gestor/GestorTanques'
import GestorProdutores from './pages/gestor/GestorProdutores'
import GestorRomaneio from './pages/gestor/GestorRomaneio'
import GestorRomaneioDetalhe from './pages/gestor/GestorRomaneioDetalhe'
import GestorChecklists from './pages/gestor/GestorChecklists'
import GestorUsuarios from './pages/gestor/GestorUsuarios'

import EletricistaDashboard from './pages/eletricista/EletricistaDashboard'
import EletricistaRomaneios from './pages/eletricista/EletricistaRomaneios'
import EletricistaRomaneioDetalhe from './pages/eletricista/EletricistaRomaneioDetalhe'
import EletricistaTrabalhos from './pages/eletricista/EletricistaTrabalhos'

import CompradorDashboard from './pages/comprador/CompradorDashboard'
import NovoPedido from './pages/comprador/NovoPedido'
import EditarPedido from './pages/comprador/EditarPedido'

import AdminCriarGestores from './pages/admin/AdminCriarGestores'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<IndexRedirect />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ShellLayout />}>
            <Route path="/gestor" element={<RoleGate roles={[ROLES.GESTOR]} />}>
              <Route index element={<GestorDashboard />} />
              <Route path="pedidos" element={<GestorPedidos />} />
              <Route path="tanques" element={<GestorTanques />} />
              <Route path="produtores" element={<GestorProdutores />} />
              <Route path="romaneio" element={<GestorRomaneio />} />
              <Route path="romaneio/:id" element={<GestorRomaneioDetalhe />} />
              <Route path="checklists" element={<GestorChecklists />} />
              <Route path="usuarios" element={<GestorUsuarios />} />
            </Route>
            <Route path="/eletricista" element={<RoleGate roles={[ROLES.ELETRICISTA]} />}>
              <Route index element={<EletricistaDashboard />} />
              <Route path="romaneios" element={<EletricistaRomaneios />} />
              <Route path="romaneios/:id" element={<EletricistaRomaneioDetalhe />} />
              <Route path="trabalhos" element={<EletricistaTrabalhos />} />
            </Route>
            <Route path="/comprador" element={<RoleGate roles={[ROLES.COMPRADOR]} />}>
              <Route index element={<CompradorDashboard />} />
              <Route path="novo" element={<NovoPedido />} />
              <Route path="pedido/:id" element={<EditarPedido />} />
            </Route>
            <Route path="/admin" element={<RoleGate roles={[ROLES.ADMIN_GERAL]} />}>
              <Route index element={<AdminCriarGestores />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      <ToastContainer position="top-right" theme="colored" />
    </AuthProvider>
  )
}
