import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function GestorProdutores() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [tanques, setTanques] = useState([])
  const [cadastroModalOpen, setCadastroModalOpen] = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  const tanquesPorProdutor = useMemo(() => {
    const m = {}
    for (const t of tanques) {
      if (!t.producerId || t.inutilizado) continue
      if (!m[t.producerId]) m[t.producerId] = []
      m[t.producerId].push(t)
    }
    return m
  }, [tanques])

  async function handleAdd(e) {
    e.preventDefault()
    if (!profile?.id) return
    try {
      await addDoc(collection(db, 'produtores'), {
        name: name.trim(),
        region: region.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: profile.id,
      })
      setName('')
      setRegion('')
      setPhone('')
      setAddress('')
      setCadastroModalOpen(false)
      toast.success('Produtor registado.')
    } catch {
      toast.error('Erro ao guardar.')
    }
  }

  function abrirEdicao(r) {
    setEditing(r)
    setEditName(r.name || '')
    setEditRegion(r.region || '')
    setEditPhone(r.phone || '')
    setEditAddress(r.address || '')
  }

  function fecharEdicao() {
    setEditing(null)
    setEditName('')
    setEditRegion('')
    setEditPhone('')
    setEditAddress('')
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    if (!editing) return
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, 'produtores', editing.id), {
        name: editName.trim(),
        region: editRegion.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        updatedAt: serverTimestamp(),
      })
      toast.success('Produtor atualizado.')
      fecharEdicao()
    } catch {
      toast.error('Erro ao guardar alterações.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function eliminarProdutor(r) {
    try {
      const vinc = query(collection(db, 'tanques'), where('producerId', '==', r.id))
      const snap = await getDocs(vinc)
      if (!snap.empty) {
        toast.error(
          'Existem tanques vinculados a este produtor. Desvincule-os em Tanques antes de eliminar.',
        )
        return
      }
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível verificar vínculos.'))
      return
    }
    if (!window.confirm(`Eliminar permanentemente o produtor "${r.name}"?`)) return
    try {
      await deleteDoc(doc(db, 'produtores', r.id))
      if (editing?.id === r.id) fecharEdicao()
      toast.success('Produtor eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar.'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitleWithHelp title="Produtores" tooltipId="help-gestor-produtores">
          <p>
            Produtores rurais onde os tanques são instalados ou mantidos. Cada produtor pode ficar{' '}
            <strong>vinculado a um tanque</strong> na secção <Link to="/gestor/tanques">Tanques</Link> — isso alinha
            pedidos de instalação/troca com a frota física. Ao montar um <Link to="/gestor/romaneio">romaneio</Link>, o
            tanque entra em <strong>em uso</strong> no cadastro e o nome do produtor passa a ligar à{' '}
            <strong>ficha e histórico</strong> desse equipamento. Só pode eliminar um produtor se não houver tanques
            associados.
          </p>
        </PageTitleWithHelp>
        <button
          type="button"
          onClick={() => setCadastroModalOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Cadastrar produtor
        </button>
      </div>

      {cadastroModalOpen && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gestor-produtor-cadastro-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setCadastroModalOpen(false)}
          />
          <form
            onSubmit={handleAdd}
            className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="gestor-produtor-cadastro-titulo" className="text-lg font-semibold text-slate-900">
                Novo produtor
              </h2>
              <button
                type="button"
                onClick={() => setCadastroModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Região *</label>
              <input
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Endereço</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCadastroModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <form
          onSubmit={salvarEdicao}
          className="max-w-xl space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Editar produtor</h2>
            <button
              type="button"
              onClick={fecharEdicao}
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Região *</label>
            <input
              required
              value={editRegion}
              onChange={(e) => setEditRegion(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Endereço</label>
            <input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingEdit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingEdit ? 'A guardar…' : 'Guardar alterações'}
            </button>
            <button
              type="button"
              onClick={fecharEdicao}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-white"
            >
              Fechar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Tanque na propriedade</th>
              <th className="px-4 py-2">Região</th>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Endereço</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum produtor registado.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const vinc = tanquesPorProdutor[r.id] || []
              const principal = vinc[0]
              return (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {principal ? (
                    <Link
                      to={`/gestor/tanques?tanque=${principal.id}&tab=em_uso`}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="max-w-[14rem] px-4 py-2 text-sm text-slate-700">
                  {vinc.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {vinc.map((t) => (
                        <li key={t.id}>
                          <Link
                            to={`/gestor/tanques?tanque=${t.id}&tab=em_uso`}
                            className="font-medium text-blue-700 underline"
                          >
                            {t.modelo} · {t.volumeLitros} L
                          </Link>
                          {t.vinculadoAoProdutorEm?.toDate ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              Vínculo:{' '}
                              {format(t.vinculadoAoProdutorEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-2">{r.region}</td>
                <td className="px-4 py-2">{r.phone || '—'}</td>
                <td className="max-w-[200px] truncate px-4 py-2 text-slate-600" title={r.address || ''}>
                  {r.address || '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(r)}
                      className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarProdutor(r)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
