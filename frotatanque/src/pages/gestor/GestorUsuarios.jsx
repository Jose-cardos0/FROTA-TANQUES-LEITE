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
import { ROLES, ROLE_LABELS } from '../../constants/roles'
import { toast } from 'react-toastify'
import { authErrorMessagePT } from '../../utils/firebaseAuthErrors'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'
import SearchableSelect from '../../components/SearchableSelect'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'

export default function GestorUsuarios() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState(ROLES.COMPRADOR)
  const [saving, setSaving] = useState(false)

  const roleOptions = useMemo(
    () =>
      Object.values(ROLES)
        .filter((r) => r !== ROLES.ADMIN_GERAL)
        .map((r) => ({ value: r, label: ROLE_LABELS[r] })),
    [],
  )

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
      setUsers(list)
    })
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!profile?.id) return
    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim(),
        displayName: displayName.trim() || email.trim(),
        role,
        createdAt: serverTimestamp(),
        createdBy: profile.id,
        disabled: false,
      })
      await signOut(secondaryAuth)
      setEmail('')
      setPassword('')
      setDisplayName('')
      setRole(ROLES.COMPRADOR)
      toast.success('Utilizador criado.')
    } catch (err) {
      console.error(err)
      toast.error(authErrorMessagePT(err, 'Não foi possível criar o utilizador. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleDisabled(u) {
    try {
      await updateDoc(doc(db, 'users', u.id), {
        disabled: !u.disabled,
      })
      toast.success(u.disabled ? 'Acesso reativado.' : 'Acesso revogado (soft delete).')
    } catch {
      toast.error('Erro ao atualizar.')
    }
  }

  async function eliminarAcesso(u) {
    if (u.id === profile?.id) return
    if (u.role === ROLES.ADMIN_GERAL) {
      toast.error('O administrador geral Natville não pode ser eliminado aqui.')
      return
    }
    const ok = window.confirm(
      `Eliminar definitivamente o acesso de "${u.displayName || u.email}"?\n\n` +
        'O perfil será apagado: esta pessoa deixa de conseguir usar a aplicação.\n\n' +
        'Nota: a conta de email pode continuar a existir no Firebase Authentication. Para remover o email de vez, apague também o utilizador em Firebase Console → Authentication.',
    )
    if (!ok) return
    try {
      await deleteDoc(doc(db, 'users', u.id))
      toast.success('Acesso eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar o acesso. Tente novamente.'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitleWithHelp title="Utilizadores" tooltipId="help-gestor-utilizadores">
          <p>
            Quem entra na app: <strong>compradores de leite</strong> abrem pedidos, <strong>gestores</strong> operam
            frota e romaneios, <strong>eletricistas</strong> executam visitas. Crie contas com email e palavra-passe.
            Pode <strong>revogar</strong> (bloquear login sem apagar o documento) ou <strong>eliminar</strong> o perfil em
            Firestore — a conta no Firebase Authentication pode continuar até ser removida na consola Firebase.
          </p>
        </PageTitleWithHelp>
      </div>

      <form
        onSubmit={handleCreate}
        className="max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="font-semibold text-slate-900">Novo utilizador</h2>
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
        <div>
          <label className="text-sm font-medium">Função *</label>
          <SearchableSelect
            value={role}
            onChange={setRole}
            options={roleOptions}
            placeholder="Função"
            title="Função do utilizador"
            className="mt-1"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'A criar…' : 'Criar utilizador'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Função</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-2">{u.displayName}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-4 py-2">{u.disabled ? 'Revogado' : 'Ativo'}</td>
                <td className="px-4 py-2">
                  {u.id !== profile?.id && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => toggleDisabled(u)}
                        className="text-sm text-amber-800 underline"
                      >
                        {u.disabled ? 'Reativar' : 'Revogar acesso'}
                      </button>
                      {u.role !== ROLES.ADMIN_GERAL && (
                        <button
                          type="button"
                          onClick={() => eliminarAcesso(u)}
                          className="text-sm font-medium text-red-700 underline"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
