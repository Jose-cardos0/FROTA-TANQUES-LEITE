import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, secondaryAuth } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_NATVILLE_EMAIL, ROLES, ROLE_LABELS } from '../../constants/roles'
import { toast } from 'react-toastify'
import { authErrorMessagePT } from '../../utils/firebaseAuthErrors'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'

/**
 * Apenas a conta admin@natville.com (role admin_geral) acede aqui.
 * Cria utilizadores com função gestor — primeiro passo antes do painel completo do gestor.
 */
export default function AdminCriarGestores() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      setUsers(list)
    })
  }, [])

  const gestores = useMemo(
    () => users.filter((u) => u.role === ROLES.GESTOR),
    [users],
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (!profile?.id) return
    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim(),
        displayName: displayName.trim() || email.trim(),
        role: ROLES.GESTOR,
        createdAt: serverTimestamp(),
        createdBy: profile.id,
        disabled: false,
      })
      await signOut(secondaryAuth)
      setEmail('')
      setPassword('')
      setDisplayName('')
      toast.success('Gestor criado. Pode enviar as credenciais ao responsável.')
    } catch (err) {
      console.error(err)
      toast.error(authErrorMessagePT(err, 'Não foi possível criar o gestor. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleDisabled(u) {
    try {
      await updateDoc(doc(db, 'users', u.id), {
        disabled: !u.disabled,
      })
      toast.success(u.disabled ? 'Gestor reativado.' : 'Acesso do gestor revogado.')
    } catch {
      toast.error('Erro ao atualizar.')
    }
  }

  async function eliminarGestor(u) {
    const ok = window.confirm(
      `Eliminar definitivamente o gestor "${u.displayName || u.email}"?\n\n` +
        'O perfil será apagado. A conta de email pode continuar no Firebase Authentication até ser removida no consola.',
    )
    if (!ok) return
    try {
      await deleteDoc(doc(db, 'users', u.id))
      toast.success('Gestor eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar. Tente novamente.'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administrador geral — criar gestores</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Conta reservada a <strong>{ADMIN_NATVILLE_EMAIL}</strong>. Use esta página para o <strong>onboarding</strong> dos
          gestores operacionais: eles criam utilizadores (compradores, eletricistas), tratam{' '}
          <strong>pedidos</strong>, <strong>tanques</strong>, <strong>produtores</strong> e <strong>romaneios</strong> na
          área do gestor. Compradores e restantes perfis podem ser criados depois pelo próprio gestor em Utilizadores.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="font-semibold text-slate-900">Novo gestor</h2>
        <div>
          <label className="text-sm font-medium">Nome</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email *</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Palavra-passe *</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <p className="text-xs text-slate-500">Função atribuída automaticamente: {ROLE_LABELS[ROLES.GESTOR]}.</p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'A criar…' : 'Criar gestor'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
          Gestores registados ({gestores.length})
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {gestores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Ainda não criou nenhum gestor.
                </td>
              </tr>
            )}
            {gestores.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-2">{u.displayName}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.disabled ? 'Revogado' : 'Ativo'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => toggleDisabled(u)}
                      className="text-sm text-amber-800 underline"
                    >
                      {u.disabled ? 'Reativar' : 'Revogar acesso'}
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarGestor(u)}
                      className="text-sm font-medium text-red-700 underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
