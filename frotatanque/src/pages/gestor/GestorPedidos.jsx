import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { Pencil, Trash2, X, XCircle } from 'lucide-react'
import { db } from '../../firebase/config'
import { toast } from 'react-toastify'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'
import { computeRomaneioStatus } from '../../utils/romaneio'
import {
  PEDIDO_STATUS,
  PEDIDO_TIPO_LABELS,
  PEDIDO_STATUS_LABELS,
  ITEM_ROMANEIO_STATUS,
} from '../../constants/roles'
import { revertTanqueRomaneioPendente } from '../../services/tanqueLifecycle'
import MapReadOnly from '../../components/MapReadOnly'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function GestorPedidos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'abertos'
  const [pedidos, setPedidos] = useState([])
  const [tanques, setTanques] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [mapModal, setMapModal] = useState(null)
  const [notesModalPedido, setNotesModalPedido] = useState(null)
  const [notesModalText, setNotesModalText] = useState('')
  const [savingNotesId, setSavingNotesId] = useState(null)
  const [rejectModalPedido, setRejectModalPedido] = useState(null)
  const [rejectModalText, setRejectModalText] = useState('')
  const [savingRejectId, setSavingRejectId] = useState(null)
  const PAGE_SIZE = 8
  const [page, setPage] = useState(1)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'pedidos'), orderBy('createdAt', 'desc')),
      (s) => {
        setPedidos(s.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  const tanqueById = useMemo(() => {
    const m = {}
    for (const t of tanques) m[t.id] = t
    return m
  }, [tanques])

  const filtered = useMemo(() => {
    if (tab === 'abertos') {
      return pedidos.filter((p) =>
        [
          PEDIDO_STATUS.ABERTO,
          PEDIDO_STATUS.VINCULADO,
          PEDIDO_STATUS.EM_ROMANEIO,
        ].includes(p.status),
      )
    }
    if (tab === 'atualizados') {
      return pedidos.filter((p) => p.lastCompradorEditAt)
    }
    if (tab === 'finalizados') {
      return pedidos.filter((p) => p.status === PEDIDO_STATUS.CONCLUIDO)
    }
    return pedidos
  }, [pedidos, tab])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  }, [filtered.length])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const visiblePedidos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filtered.slice(start, end)
  }, [filtered, page])

  function setTab(t) {
    setSearchParams(t === 'abertos' ? {} : { tab: t })
  }

  function tanqueResumo(p) {
    const id = p.tanqueId
    if (!id) return null
    const t = tanqueById[id]
    if (t) return `${t.modelo} · ${t.volumeLitros} L`
    return `Ref. ${id.slice(0, 8)}…`
  }

  useEffect(() => {
    if (!mapModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMapModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapModal])

  useEffect(() => {
    if (!notesModalPedido) return
    const onKey = (e) => {
      if (e.key === 'Escape') setNotesModalPedido(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notesModalPedido])

  useEffect(() => {
    if (!rejectModalPedido) return
    const onKey = (e) => {
      if (e.key === 'Escape') setRejectModalPedido(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rejectModalPedido])

  async function guardarNotasGestor() {
    if (!notesModalPedido) return
    setSavingNotesId(notesModalPedido.id)
    try {
      await updateDoc(doc(db, 'pedidos', notesModalPedido.id), {
        notes: notesModalText.trim(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Notas atualizadas.')
      setNotesModalPedido(null)
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível guardar as notas.'))
    } finally {
      setSavingNotesId(null)
    }
  }

  async function guardarRecusaGestor() {
    if (!rejectModalPedido) return
    const motivo = rejectModalText.trim()
    if (!motivo) {
      toast.error('Indique o motivo da recusa.')
      return
    }
    setSavingRejectId(rejectModalPedido.id)
    try {
      // Remover do romaneio qualquer ocorrência deste pedido (se ainda não estiver concluído).
      const rSnap = await getDocs(collection(db, 'romaneios'))
      for (const rd of rSnap.docs) {
        const r = { id: rd.id, ...rd.data() }
        const itens = r.itens || []
        const item = itens.find((i) => i.pedidoId === rejectModalPedido.id)
        if (!item) continue

        const newItens = itens.filter((i) => i.pedidoId !== rejectModalPedido.id)
        if (
          item.tanqueId &&
          rejectModalPedido.status === PEDIDO_STATUS.EM_ROMANEIO &&
          item.status !== ITEM_ROMANEIO_STATUS.CONCLUIDO
        ) {
          await revertTanqueRomaneioPendente({
            tanqueId: item.tanqueId,
            pedidoId: rejectModalPedido.id,
            romaneioId: r.id,
            romaneioTitulo: r.titulo || '',
            motivo: 'pedido_recusado',
            pedidoStatus: rejectModalPedido.status,
            itemStatus: item.status,
            producerName: item.producerNameSnapshot || rejectModalPedido.producerName || '',
          })
        }

        await updateDoc(doc(db, 'romaneios', r.id), {
          itens: newItens,
          status: computeRomaneioStatus(newItens),
          updatedAt: serverTimestamp(),
        })
      }

      await updateDoc(doc(db, 'pedidos', rejectModalPedido.id), {
        status: PEDIDO_STATUS.CANCELADO,
        refusedReason: motivo,
        refusedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast.success('Pedido recusado.')
      setRejectModalPedido(null)
      setRejectModalText('')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível recusar o pedido.'))
    } finally {
      setSavingRejectId(null)
    }
  }

  function pedidoTemCoordenadas(p) {
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    return Number.isFinite(lat) && Number.isFinite(lng)
  }

  async function eliminarPedido(p) {
    if (deletingId) return
    const nome = p.producerName || 'este pedido'
    const emLista = p.status === PEDIDO_STATUS.EM_ROMANEIO
    const ok = window.confirm(
      `Eliminar permanentemente o pedido de "${nome}"?\n\n` +
        (emLista
          ? 'Será removido de qualquer romaneio em que estiver. '
          : '') +
        'Esta ação não pode ser desfeita.',
    )
    if (!ok) return
    setDeletingId(p.id)
    try {
      const rSnap = await getDocs(collection(db, 'romaneios'))
      for (const rd of rSnap.docs) {
        const r = { id: rd.id, ...rd.data() }
        const itens = r.itens || []
        const item = itens.find((i) => i.pedidoId === p.id)
        if (!item) continue
        const newItens = itens.filter((i) => i.pedidoId !== p.id)
        if (
          item.tanqueId &&
          p.status === PEDIDO_STATUS.EM_ROMANEIO &&
          item.status !== ITEM_ROMANEIO_STATUS.CONCLUIDO
        ) {
          await revertTanqueRomaneioPendente({
            tanqueId: item.tanqueId,
            pedidoId: p.id,
            romaneioId: r.id,
            romaneioTitulo: r.titulo || '',
            motivo: 'pedido_eliminado',
            pedidoStatus: p.status,
            itemStatus: item.status,
            producerName: item.producerNameSnapshot || p.producerName || '',
          })
        }
        await updateDoc(doc(db, 'romaneios', r.id), {
          itens: newItens,
          status: computeRomaneioStatus(newItens),
          updatedAt: serverTimestamp(),
        })
      }
      await deleteDoc(doc(db, 'pedidos', p.id))
      toast.success('Pedido eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar o pedido.'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <p className="text-slate-600">A carregar pedidos…</p>

  return (
    <div className="space-y-6">
      <div>
        <PageTitleWithHelp title="Pedidos" tooltipId="help-gestor-pedidos">
          <p>
            Fluxo da frota: os <strong>compradores de leite</strong> abrem pedidos de{' '}
            <strong>instalação, troca, remoção ou manutenção</strong> de tanques em propriedades de produtores. Aqui vê
            o que foi pedido (tipo, volume desejado, <strong>notas do comprador</strong>) e, quando aplicável,{' '}
            <strong>qual tanque da frota</strong> já está vinculado ao pedido. Use estes dados para montar{' '}
            <Link to="/gestor/romaneio">romaneios</Link> e definir a rota do dia para os eletricistas. Pode{' '}
            <strong>eliminar</strong> um pedido (inclui retirá-lo automaticamente dos romaneios onde ainda apareça). O
            histórico detalhado de cada equipamento (vínculos, visitas, baixas) está em{' '}
            <Link to="/gestor/tanques">Tanques</Link>.
          </p>
        </PageTitleWithHelp>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'abertos', label: 'Abertos / em processamento' },
          { id: 'atualizados', label: 'Atualizados pelo comprador' },
          { id: 'finalizados', label: 'Finalizados (eletricista)' },
          { id: 'todos', label: 'Todos' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setTab(b.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === b.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-3 py-2">Produtor</th>
              <th className="px-3 py-2">Região</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Vol. pedido (L)</th>
              <th className="min-w-[10rem] max-w-[16rem] px-3 py-2">Solicitação / notas (comprador)</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Mapa</th>
              <th className="px-3 py-2">Histórico comprador</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Nenhum pedido nesta lista.
                </td>
              </tr>
            )}
            {visiblePedidos.map((p) => {
              const notas = (p.notes || '').trim()
              const tanqueTxt = tanqueResumo(p)
              const mostrarTanque =
                p.tanqueId ||
                p.status === PEDIDO_STATUS.VINCULADO ||
                p.status === PEDIDO_STATUS.EM_ROMANEIO
              return (
                <tr key={p.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium">{p.producerName}</td>
                  <td className="px-3 py-2">{p.region}</td>
                  <td className="px-3 py-2">
                    {PEDIDO_TIPO_LABELS[p.tipoPedido] || p.tipoPedido || '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.volumeLitros}</td>
                  <td className="min-w-[10rem] max-w-[16rem] px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      {notas ? (
                        <p className="line-clamp-4 text-slate-700" title={notas}>
                          {notas}
                        </p>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNotesModalPedido(p)
                          setNotesModalText(p.notes || '')
                        }}
                        className="inline-flex items-center gap-1 self-start text-xs font-medium text-blue-700 underline hover:text-blue-900"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        Editar notas
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">
                      {PEDIDO_STATUS_LABELS[p.status] || p.status}
                    </span>
                    {mostrarTanque && (
                      <div className="mt-1.5 border-l-2 border-blue-200 pl-2 text-xs text-slate-600">
                        {tanqueTxt ? (
                          <>
                            <span className="font-medium text-slate-700">Tanque na frota:</span> {tanqueTxt}
                          </>
                        ) : p.status === PEDIDO_STATUS.VINCULADO ? (
                          <span className="text-amber-800">
                            Estado “tanque vinculado” sem ID de tanque no pedido — corrija em Tanques / pedido.
                          </span>
                        ) : (
                          <span className="text-slate-500">Ainda sem tanque atribuído ao pedido.</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-36">
                      {pedidoTemCoordenadas(p) ? (
                        <div className="relative">
                          <MapReadOnly lat={p.lat} lng={p.lng} heightClass="h-20" />
                          <button
                            type="button"
                            className="absolute inset-0 z-[1000] flex cursor-pointer items-center justify-center rounded-lg bg-transparent transition hover:bg-slate-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                            aria-label="Ampliar mapa e ver latitude e longitude"
                            onClick={() =>
                              setMapModal({
                                lat: Number(p.lat),
                                lng: Number(p.lng),
                                producerName: p.producerName,
                                pedidoId: p.id,
                              })
                            }
                          />
                          <span className="pointer-events-none absolute bottom-0.5 left-0.5 right-0.5 rounded bg-white/95 px-1 py-0.5 text-center text-[9px] font-medium text-slate-600 shadow-sm">
                            Clicar para ampliar
                          </span>
                        </div>
                      ) : (
                        <MapReadOnly lat={p.lat} lng={p.lng} heightClass="h-20" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(p.editHistory || []).length} edições
                    {p.lastCompradorEditAt && (
                      <span className="mt-1 block text-blue-700">
                        Última:{' '}
                        {format(
                          p.lastCompradorEditAt?.toDate?.() || new Date(p.lastCompradorEditAt),
                          'dd/MM/yyyy HH:mm',
                          { locale: ptBR },
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <Link
                        to="/gestor/romaneio"
                        className="text-xs font-medium text-blue-700 underline"
                      >
                        Romaneio
                      </Link>
                      {[PEDIDO_STATUS.ABERTO, PEDIDO_STATUS.VINCULADO, PEDIDO_STATUS.EM_ROMANEIO].includes(
                        p.status,
                      ) ? (
                        <button
                          type="button"
                          disabled={savingRejectId === p.id}
                          onClick={() => {
                            setRejectModalPedido(p)
                            setRejectModalText('')
                          }}
                          className="inline-flex items-center gap-2 text-xs font-medium text-red-700 underline hover:text-red-900 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden />
                          {savingRejectId === p.id ? 'A recusar…' : 'Recusar'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => eliminarPedido(p)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-900 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {deletingId === p.id ? 'A eliminar…' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Página <span className="font-medium text-slate-800">{page}</span> de{' '}
          <span className="font-medium text-slate-800">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>

      {notesModalPedido &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestor-pedido-notas-titulo"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Fechar"
              onClick={() => setNotesModalPedido(null)}
            />
            <div className="relative z-10 flex max-h-[min(90vh,32rem)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 id="gestor-pedido-notas-titulo" className="text-lg font-semibold text-slate-900">
                    Notas do comprador (gestor)
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">{notesModalPedido.producerName || 'Pedido'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotesModalPedido(null)}
                  className="shrink-0 rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                O texto substitui as notas do pedido. O eletricista e o comprador passam a ver esta versão.
              </p>
              <textarea
                value={notesModalText}
                onChange={(e) => setNotesModalText(e.target.value)}
                rows={8}
                className="mt-3 w-full flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Instruções, referências de acesso…"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingNotesId === notesModalPedido.id}
                  onClick={guardarNotasGestor}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingNotesId === notesModalPedido.id ? 'A guardar…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setNotesModalPedido(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {rejectModalPedido &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestor-pedido-recusa-titulo"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Fechar"
              onClick={() => setRejectModalPedido(null)}
            />
            <div className="relative z-10 flex max-h-[min(90vh,32rem)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 id="gestor-pedido-recusa-titulo" className="text-lg font-semibold text-slate-900">
                    Recusar pedido
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {rejectModalPedido.producerName || 'Pedido'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectModalPedido(null)}
                  className="shrink-0 rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Esta recusa será enviada ao comprador como motivo (fica visível no seu painel).
              </p>
              <textarea
                value={rejectModalText}
                onChange={(e) => setRejectModalText(e.target.value)}
                rows={7}
                className="mt-3 w-full flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Motivo da recusa…"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingRejectId === rejectModalPedido.id}
                  onClick={guardarRecusaGestor}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {savingRejectId === rejectModalPedido.id ? 'A recusar…' : 'Recusar pedido'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalPedido(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mapModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestor-pedido-mapa-titulo"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Fechar"
              onClick={() => setMapModal(null)}
            />
            <div className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 id="gestor-pedido-mapa-titulo" className="text-lg font-semibold text-slate-900">
                    Localização no mapa
                  </h2>
                  {mapModal.producerName ? (
                    <p className="mt-0.5 text-sm text-slate-600">{mapModal.producerName}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-slate-500">Pedido {mapModal.pedidoId.slice(0, 8)}…</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMapModal(null)}
                  className="shrink-0 rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <dt className="font-medium text-slate-600">Latitude</dt>
                <dd className="font-mono tabular-nums text-slate-900">{mapModal.lat.toFixed(6)}</dd>
                <dt className="font-medium text-slate-600">Longitude</dt>
                <dd className="font-mono tabular-nums text-slate-900">{mapModal.lng.toFixed(6)}</dd>
              </dl>
              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200">
                <MapReadOnly
                  lat={mapModal.lat}
                  lng={mapModal.lng}
                  heightClass="h-72 sm:h-80"
                  scrollWheelZoom
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">OpenStreetMap — pode fazer zoom com a roda do rato.</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
