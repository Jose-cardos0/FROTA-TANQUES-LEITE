import { useEffect, useMemo, useState } from 'react'
import SearchableSelect from '../../components/SearchableSelect'
import { Link, useParams } from 'react-router-dom'
import {
  doc,
  onSnapshot,
  getDoc,
  collection,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { ITEM_ROMANEIO_STATUS, PEDIDO_STATUS, ROMANEIO_STATUS_LABELS } from '../../constants/roles'
import { revertTanqueRomaneioPendente } from '../../services/tanqueLifecycle'
import MapReadOnly from '../../components/MapReadOnly'
import { romaneioProgress, computeRomaneioStatus } from '../../utils/romaneio'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'react-toastify'

const ITEM_LABEL = {
  [ITEM_ROMANEIO_STATUS.PENDENTE]: 'Pendente',
  [ITEM_ROMANEIO_STATUS.EM_ANDAMENTO]: 'Em andamento',
  [ITEM_ROMANEIO_STATUS.CONCLUIDO]: 'Concluído',
  [ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR]: 'Incompleto — reagendar',
  [ITEM_ROMANEIO_STATUS.CANCELADO]: 'Cancelado',
}

function itemStatusLabel(s) {
  return ITEM_LABEL[s] || s || '—'
}

export default function GestorRomaneioDetalhe() {
  const { id } = useParams()
  const [romaneio, setRomaneio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pedidosMap, setPedidosMap] = useState({})
  const [tanqueById, setTanqueById] = useState({})
  const [eletricistaNome, setEletricistaNome] = useState('')
  const [todosRomaneios, setTodosRomaneios] = useState([])
  const [userMap, setUserMap] = useState({})
  const [processingItemId, setProcessingItemId] = useState(null)
  const [transferTarget, setTransferTarget] = useState({})
  const [notesDraftByPedido, setNotesDraftByPedido] = useState({})
  const [savingNotesPedidoId, setSavingNotesPedidoId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    return onSnapshot(collection(db, 'romaneios'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setTodosRomaneios(list)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (s) => {
      const m = {}
      for (const d of s.docs) {
        const x = d.data()
        m[d.id] = x.displayName || x.email || d.id
      }
      setUserMap(m)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) => {
      const m = {}
      for (const d of s.docs) m[d.id] = { id: d.id, ...d.data() }
      setTanqueById(m)
    })
  }, [])

  useEffect(() => {
    if (!id) return undefined
    const unsub = onSnapshot(doc(db, 'romaneios', id), (snap) => {
      if (!snap.exists()) {
        setRomaneio(null)
        setLoading(false)
        return
      }
      setRomaneio({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    if (!romaneio?.eletricistaId) {
      setEletricistaNome('')
      return
    }
    let cancelled = false
    getDoc(doc(db, 'users', romaneio.eletricistaId)).then((snap) => {
      if (cancelled) return
      if (snap.exists()) {
        const d = snap.data()
        setEletricistaNome(d.displayName || d.email || romaneio.eletricistaId)
      } else {
        setEletricistaNome(romaneio.eletricistaId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [romaneio?.eletricistaId])

  const pedidoIdsKey = useMemo(
    () => romaneio?.itens?.map((i) => i.pedidoId).filter(Boolean).join(',') ?? '',
    [romaneio?.itens],
  )

  useEffect(() => {
    if (!pedidoIdsKey) {
      setPedidosMap({})
      return
    }
    let cancelled = false
    const ids = [...new Set(pedidoIdsKey.split(',').filter(Boolean))]
    async function load() {
      const m = {}
      await Promise.all(
        ids.map(async (pid) => {
          const ps = await getDoc(doc(db, 'pedidos', pid))
          if (ps.exists()) m[pid] = { id: ps.id, ...ps.data() }
        }),
      )
      if (!cancelled) setPedidosMap(m)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [pedidoIdsKey])

  const romaneiosDestino = useMemo(
    () => todosRomaneios.filter((r) => r.id !== id),
    [todosRomaneios, id],
  )

  const statusCards = useMemo(() => {
    const list = romaneio?.itens || []
    const counts = {}
    for (const it of list) {
      counts[it.status] = (counts[it.status] || 0) + 1
    }
    const cards = [
      { id: 'all', label: 'Todos', count: list.length, style: 'border-slate-200 bg-slate-50 text-slate-800' },
      {
        id: ITEM_ROMANEIO_STATUS.PENDENTE,
        label: itemStatusLabel(ITEM_ROMANEIO_STATUS.PENDENTE),
        count: counts[ITEM_ROMANEIO_STATUS.PENDENTE] || 0,
        style: 'border-amber-200 bg-amber-50 text-amber-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.EM_ANDAMENTO,
        label: itemStatusLabel(ITEM_ROMANEIO_STATUS.EM_ANDAMENTO),
        count: counts[ITEM_ROMANEIO_STATUS.EM_ANDAMENTO] || 0,
        style: 'border-blue-200 bg-blue-50 text-blue-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.CONCLUIDO,
        label: itemStatusLabel(ITEM_ROMANEIO_STATUS.CONCLUIDO),
        count: counts[ITEM_ROMANEIO_STATUS.CONCLUIDO] || 0,
        style: 'border-green-200 bg-green-50 text-green-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR,
        label: itemStatusLabel(ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR),
        count: counts[ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR] || 0,
        style: 'border-amber-200 bg-amber-50 text-amber-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.CANCELADO,
        label: itemStatusLabel(ITEM_ROMANEIO_STATUS.CANCELADO),
        count: counts[ITEM_ROMANEIO_STATUS.CANCELADO] || 0,
        style: 'border-red-200 bg-red-50 text-red-900',
      },
    ]
    return cards
  }, [romaneio?.itens])

  const itensFiltrados = useMemo(() => {
    const list = romaneio?.itens || []
    if (statusFilter === 'all') return list
    return list.filter((it) => it.status === statusFilter)
  }, [romaneio?.itens, statusFilter])

  const transferOptions = useMemo(() => {
    if (romaneiosDestino.length === 0) {
      return [{ value: '', label: '— Nenhuma outra lista —' }]
    }
    return [
      { value: '', label: '— Escolher lista —' },
      ...romaneiosDestino.map((r) => {
        const n = (r.itens || []).length
        const el = userMap[r.eletricistaId] || 'Eletricista'
        return {
          value: r.id,
          label: `${r.titulo || r.id} · ${el} · ${n} ped.`,
        }
      }),
    ]
  }, [romaneiosDestino, userMap])

  async function removerItemDaLista(item) {
    if (!romaneio?.id) return
    if (processingItemId) return
    const nome = item.producerNameSnapshot || pedidosMap[item.pedidoId]?.producerName || 'este pedido'
    if (
      !window.confirm(
        `Remover "${nome}" desta lista?\n\nSe o pedido ainda estiver "em romaneio", volta para aberto ou vinculado.`,
      )
    ) {
      return
    }
    setProcessingItemId(item.id)
    try {
      const newItens = (romaneio.itens || []).filter((i) => i.id !== item.id)
      await updateDoc(doc(db, 'romaneios', romaneio.id), {
        itens: newItens,
        status: computeRomaneioStatus(newItens),
        updatedAt: serverTimestamp(),
      })
      if (item.pedidoId) {
        const pref = doc(db, 'pedidos', item.pedidoId)
        const ps = await getDoc(pref)
        if (ps.exists()) {
          const p = ps.data()
          const pedidoStatus = p.status
          if (item.tanqueId) {
            await revertTanqueRomaneioPendente({
              tanqueId: item.tanqueId,
              pedidoId: item.pedidoId,
              romaneioId: romaneio.id,
              romaneioTitulo: romaneio.titulo || '',
              motivo: 'item_removido',
              pedidoStatus,
              itemStatus: item.status,
              producerName: item.producerNameSnapshot || p.producerName || '',
            })
          }
          if (
            p.status === PEDIDO_STATUS.EM_ROMANEIO &&
            item.status !== ITEM_ROMANEIO_STATUS.CONCLUIDO
          ) {
            await updateDoc(pref, {
              status: PEDIDO_STATUS.ABERTO,
              tanqueId: null,
              romaneioRecolher: false,
              updatedAt: serverTimestamp(),
            })
          }
        }
      }
      toast.success('Pedido removido da lista.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível remover.')
    } finally {
      setProcessingItemId(null)
    }
  }

  async function guardarNotasPedidoGestor(pedidoId) {
    if (!pedidoId) return
    const ped = pedidosMap[pedidoId]
    const text =
      notesDraftByPedido[pedidoId] !== undefined
        ? notesDraftByPedido[pedidoId]
        : (ped?.notes ?? '')
    setSavingNotesPedidoId(pedidoId)
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        notes: String(text).trim(),
        updatedAt: serverTimestamp(),
      })
      setPedidosMap((prev) => ({
        ...prev,
        [pedidoId]: prev[pedidoId]
          ? { ...prev[pedidoId], notes: String(text).trim() }
          : { id: pedidoId, notes: String(text).trim() },
      }))
      setNotesDraftByPedido((prev) => {
        const next = { ...prev }
        delete next[pedidoId]
        return next
      })
      toast.success('Notas do pedido atualizadas.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível guardar as notas.')
    } finally {
      setSavingNotesPedidoId(null)
    }
  }

  async function transferirItem(item) {
    if (!romaneio?.id) return
    const targetId = transferTarget[item.id]
    if (!targetId) {
      toast.info('Escolha a lista de destino.')
      return
    }
    if (targetId === romaneio.id) return
    if (processingItemId) return

    const targetSnap = await getDoc(doc(db, 'romaneios', targetId))
    if (!targetSnap.exists()) {
      toast.error('Lista de destino não encontrada.')
      return
    }
    const target = { id: targetSnap.id, ...targetSnap.data() }
    if ((target.itens || []).some((i) => i.pedidoId === item.pedidoId)) {
      toast.error('Esse pedido já existe na lista de destino.')
      return
    }

    const nome = item.producerNameSnapshot || pedidosMap[item.pedidoId]?.producerName || 'Pedido'
    const destTitulo = target.titulo || target.id
    const destEl = userMap[target.eletricistaId] || 'outro eletricista'
    if (
      !window.confirm(
        `Transferir "${nome}" para "${destTitulo}" (${destEl})?\n\nO pedido continua em romaneio na nova lista.`,
      )
    ) {
      return
    }

    setProcessingItemId(item.id)
    try {
      const newSourceItens = (romaneio.itens || []).filter((i) => i.id !== item.id)
      const newTargetItens = [...(target.itens || []), item]
      const batch = writeBatch(db)
      batch.update(doc(db, 'romaneios', romaneio.id), {
        itens: newSourceItens,
        status: computeRomaneioStatus(newSourceItens),
        updatedAt: serverTimestamp(),
      })
      batch.update(doc(db, 'romaneios', targetId), {
        itens: newTargetItens,
        status: computeRomaneioStatus(newTargetItens),
        updatedAt: serverTimestamp(),
      })
      await batch.commit()
      setTransferTarget((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      toast.success('Pedido transferido.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível transferir.')
    } finally {
      setProcessingItemId(null)
    }
  }

  if (loading) return <p className="text-slate-600">A carregar…</p>
  if (!romaneio) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Romaneio não encontrado.</p>
        <Link to="/gestor/romaneio" className="text-sm font-medium text-blue-800 underline">
          Voltar aos romaneios
        </Link>
      </div>
    )
  }

  const { total, feitos, concluidosInstalacao } = romaneioProgress(romaneio.itens)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{romaneio.titulo || 'Romaneio'}</h1>
          <p className="text-sm text-slate-600">
            {romaneio.dataInicio?.toDate
              ? format(romaneio.dataInicio.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
              : ''}{' '}
            →{' '}
            {romaneio.dataFim?.toDate
              ? format(romaneio.dataFim.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
              : ''}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Eletricista responsável:</span> {eletricistaNome || '…'}
          </p>
        </div>
        <Link
          to="/gestor/romaneio"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Voltar à lista
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Andamento (atualizado em tempo real)</h2>
        <div className="mt-3 flex flex-wrap items-baseline gap-4">
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {feitos}/{total}
          </p>
          <p className="text-sm text-slate-600">
            pedidos com baixa registada · <span className="font-medium">{concluidosInstalacao}</span> instalação(ões)
            concluída(s)
          </p>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Estado da lista: {ROMANEIO_STATUS_LABELS[romaneio.status] || romaneio.status}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pedidos na lista</h2>
        <p className="mt-1 text-sm text-slate-600">
          O que o eletricista regista nesta página reflete-se aqui (estados, notas e fotos). Como gestor pode remover
          uma linha ou transferi-la para outra lista (mesmo com outro eletricista).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {statusCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setStatusFilter(c.id)}
              aria-pressed={statusFilter === c.id}
              className={`rounded-xl border p-3 text-left shadow-sm transition ${
                statusFilter === c.id ? '' : 'hover:shadow-md'
              } ${c.style}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold">{c.label}</p>
                <p className="text-sm font-bold">{c.count}</p>
              </div>
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-5">
          {(itensFiltrados || []).map((it) => {
            const ped = pedidosMap[it.pedidoId]
            const recolherLinha = !!it.recolher || !!ped?.romaneioRecolher
            const tq = it.tanqueId ? tanqueById[it.tanqueId] : null
            const tanqueLabel = tq
              ? `${tq.modelo} · ${tq.volumeLitros} L`
              : it.tanqueId
                ? `${it.tanqueId.slice(0, 8)}…`
                : '—'
            return (
              <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {it.producerNameSnapshot || ped?.producerName || 'Produtor'}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Tanque: <span className="font-medium">{tanqueLabel}</span>
                    </p>
                    {recolherLinha ? (
                      <p className="mt-2 inline-flex rounded-full border border-orange-300 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-900">
                        RECOLHER — recolha na propriedade e devolução à Natville
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      it.status === ITEM_ROMANEIO_STATUS.CONCLUIDO
                        ? 'bg-green-100 text-green-900'
                        : it.status === ITEM_ROMANEIO_STATUS.PENDENTE
                          ? 'bg-amber-100 text-amber-900'
                          : it.status === ITEM_ROMANEIO_STATUS.EM_ANDAMENTO
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {itemStatusLabel(it.status)}
                  </span>
                </div>
                {ped && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Localização</p>
                      <MapReadOnly lat={ped.lat} lng={ped.lng} heightClass="h-40" />
                    </div>
                    <div className="text-sm text-slate-700">
                      <p>
                        <strong>Região:</strong> {ped.region}
                      </p>
                      <p>
                        <strong>Endereço:</strong> {ped.address || '—'}
                      </p>
                    </div>
                  </div>
                )}
                {it.pedidoId && pedidosMap[it.pedidoId] ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/90 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Notas do comprador (pedido)
                    </p>
                    <p className="mt-1 text-xs text-amber-800/90">
                      Visíveis para o eletricista no romaneio. Pode corrigir ou completar o texto abaixo.
                    </p>
                    <textarea
                      value={
                        notesDraftByPedido[it.pedidoId] !== undefined
                          ? notesDraftByPedido[it.pedidoId]
                          : (pedidosMap[it.pedidoId]?.notes ?? '')
                      }
                      onChange={(e) =>
                        setNotesDraftByPedido((prev) => ({
                          ...prev,
                          [it.pedidoId]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800"
                      placeholder="Sem notas do comprador."
                    />
                    <button
                      type="button"
                      disabled={savingNotesPedidoId === it.pedidoId}
                      onClick={() => guardarNotasPedidoGestor(it.pedidoId)}
                      className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
                    >
                      {savingNotesPedidoId === it.pedidoId ? 'A guardar…' : 'Guardar notas do pedido'}
                    </button>
                  </div>
                ) : null}
                {it.notasEletricista ? (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-500">Notas do eletricista</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{it.notasEletricista}</p>
                  </div>
                ) : null}
                {it.fotos?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.fotos.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block"
                        aria-label="Abrir foto em nova janela"
                      >
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-50 object-cover shadow-sm transition group-hover:border-blue-300"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gestão (gestor)</p>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                    <button
                      type="button"
                      disabled={processingItemId === it.id}
                      onClick={() => removerItemDaLista(it)}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
                    >
                      {processingItemId === it.id ? 'A processar…' : 'Remover desta lista'}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <label className="text-xs text-slate-500" htmlFor={`dest-${it.id}`}>
                          Transferir para outra lista
                        </label>
                        <SearchableSelect
                          id={`dest-${it.id}`}
                          value={transferTarget[it.id] || ''}
                          onChange={(v) => setTransferTarget((prev) => ({ ...prev, [it.id]: v }))}
                          options={transferOptions}
                          placeholder="— Escolher lista —"
                          title="Transferir para outra lista"
                          disabled={processingItemId === it.id || romaneiosDestino.length === 0}
                          className="mt-1 w-full max-w-md"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={
                          processingItemId === it.id ||
                          !transferTarget[it.id] ||
                          romaneiosDestino.length === 0
                        }
                        onClick={() => transferirItem(it)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50"
                      >
                        Transferir
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
