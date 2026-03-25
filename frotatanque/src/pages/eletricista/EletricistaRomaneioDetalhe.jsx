import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  collection,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import MapReadOnly from '../../components/MapReadOnly'
import SearchableSelect from '../../components/SearchableSelect'
import EletricistaItemFotos from '../../components/EletricistaItemFotos'
import { uploadFile } from '../../services/storage'
import { toast } from 'react-toastify'
import {
  PEDIDO_STATUS,
  ITEM_ROMANEIO_STATUS,
  ITEM_ROMANEIO_STATUS_LABELS,
  PEDIDO_TIPO_LABELS,
  ROMANEIO_STATUS,
} from '../../constants/roles'
import { fetchUserDisplayName, TANQUE_HIST_TIPO } from '../../services/tanqueLifecycle'
import { format, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { romaneioProgress, computeRomaneioStatus } from '../../utils/romaneio'
import { CheckCircle2 } from 'lucide-react'

function tsToDate(v) {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

function romaneioUltrapassouPrazo(r) {
  if (!r) return false
  const fim = tsToDate(r.dataFim)
  if (!fim) return false
  if (r.status === ROMANEIO_STATUS.CONCLUIDO || r.status === ROMANEIO_STATUS.CANCELADO) return false
  return isAfter(new Date(), fim)
}

function formatHistoricoAt(v) {
  if (!v) return '—'
  try {
    const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return '—'
  }
}

const ITEM_STATUS_OPTIONS = [
  { value: ITEM_ROMANEIO_STATUS.PENDENTE, label: 'Pendente' },
  { value: ITEM_ROMANEIO_STATUS.EM_ANDAMENTO, label: 'Em andamento' },
  { value: ITEM_ROMANEIO_STATUS.CONCLUIDO, label: 'Concluído' },
  {
    value: ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR,
    label: 'Incompleto — solicitar reagendamento ao gestor',
  },
  { value: ITEM_ROMANEIO_STATUS.CANCELADO, label: 'Cancelado' },
]

function needsPhotos(status) {
  return (
    status === ITEM_ROMANEIO_STATUS.CONCLUIDO ||
    status === ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR
  )
}

export default function EletricistaRomaneioDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [romaneio, setRomaneio] = useState(null)
  const [pedidos, setPedidos] = useState({})
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState({})
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      const snap = await getDoc(doc(db, 'romaneios', id))
      if (cancelled) return
      if (!snap.exists()) {
        setRomaneio(null)
        setLoading(false)
        return
      }
      const r = { id: snap.id, ...snap.data() }
      if (r.eletricistaId !== profile?.id) {
        setRomaneio(null)
        setLoading(false)
        return
      }
      setRomaneio(r)
      const pMap = {}
      for (const it of r.itens || []) {
        if (it.pedidoId) {
          const ps = await getDoc(doc(db, 'pedidos', it.pedidoId))
          if (ps.exists()) pMap[it.pedidoId] = { id: ps.id, ...ps.data() }
        }
      }
      setPedidos(pMap)
      const e = {}
      for (const it of r.itens || []) {
        e[it.id] = {
          status: it.status,
          notasEletricista: it.notasEletricista || '',
          files: [],
        }
      }
      setEdits(e)
      setLoading(false)
    }
    if (profile?.id) load()
    return () => {
      cancelled = true
    }
  }, [id, profile?.id])

  function setEdit(itemId, field, value) {
    setEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  async function saveItem(item) {
    const st = edits[item.id]?.status ?? item.status
    const notas = edits[item.id]?.notasEletricista ?? item.notasEletricista ?? ''
    const newFiles = edits[item.id]?.files || []
    const existingFotos = item.fotos || []

    if (needsPhotos(st) && existingFotos.length === 0 && newFiles.length === 0) {
      toast.error('Para concluir ou pedir reagendamento, anexe pelo menos uma foto.')
      return
    }

    let fotos = [...existingFotos]
    try {
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i]
        const url = await uploadFile(
          `romaneios/${romaneio.id}/${item.id}/${Date.now()}_${i}_${f.name}`,
          f,
        )
        fotos.push(url)
      }

      const terminalStates = [
        ITEM_ROMANEIO_STATUS.CONCLUIDO,
        ITEM_ROMANEIO_STATUS.CANCELADO,
        ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR,
      ]
      const isTerminal = terminalStates.includes(st)

      const notasTrim = notas.trim()
      const trechoNotas = notasTrim.slice(0, 120) || null
      const trechoCortado = notasTrim.length > 120
      const historicoBaixa = [...(item.historicoBaixa || [])]
      const lastH = historicoBaixa[historicoBaixa.length - 1]
      const deveRegistarHistorico =
        !lastH ||
        lastH.estado !== st ||
        (lastH.notasTrecho || '') !== (trechoNotas || '') ||
        !!lastH.notasCortado !== !!trechoCortado ||
        newFiles.length > 0
      if (deveRegistarHistorico) {
        historicoBaixa.push({
          at: new Date().toISOString(),
          estado: st,
          estadoLabel: ITEM_ROMANEIO_STATUS_LABELS[st] || st,
          notasTrecho: trechoNotas,
          notasCortado: trechoCortado,
        })
        while (historicoBaixa.length > 40) historicoBaixa.shift()
      }

      const newItens = (romaneio.itens || []).map((it) => {
        if (it.id !== item.id) return it
        return {
          ...it,
          status: st,
          notasEletricista: notas,
          fotos,
          historicoBaixa,
          completedAt: isTerminal ? it.completedAt || Timestamp.now() : null,
        }
      })

      const rStatus = computeRomaneioStatus(newItens)

      await updateDoc(doc(db, 'romaneios', romaneio.id), {
        itens: newItens,
        status: rStatus,
        updatedAt: serverTimestamp(),
      })

      const tanqueParaHistorico = item.tanqueId || pedidos[item.pedidoId]?.tanqueId
      const ped = item.pedidoId ? pedidos[item.pedidoId] : null
      const compradorNome = ped?.compradorId ? await fetchUserDisplayName(ped.compradorId) : ''
      const tipoPedidoLabel = PEDIDO_TIPO_LABELS[ped?.tipoPedido] || ped?.tipoPedido || ''
      const motivoSolicitacao = (ped?.notes || '').trim() || null
      const eletricistaNome = profile?.displayName || profile?.email || ''

      if (
        tanqueParaHistorico &&
        (st === ITEM_ROMANEIO_STATUS.CONCLUIDO || st === ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR)
      ) {
        const dataRef = new Date()
        const texto =
          st === ITEM_ROMANEIO_STATUS.CONCLUIDO
            ? [
                `Baixa concluída — ${format(dataRef, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
                `Romaneio: ${romaneio.titulo || romaneio.id}`,
                `Produtor: ${item.producerNameSnapshot || ''}`,
                tipoPedidoLabel && `Serviço pedido: ${tipoPedidoLabel}`,
                motivoSolicitacao && `Motivo / solicitação: ${motivoSolicitacao}`,
                compradorNome && `Comprador: ${compradorNome}`,
                eletricistaNome && `Eletricista: ${eletricistaNome}`,
                notas ? `Notas de campo: ${notas}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            : [
                `Reagendamento / incompleto — ${format(dataRef, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
                `Romaneio: ${romaneio.titulo || romaneio.id}`,
                `Produtor: ${item.producerNameSnapshot || ''}`,
                notas ? `Notas: ${notas}` : '',
              ]
                .filter(Boolean)
                .join('\n')

        const tipoHist =
          st === ITEM_ROMANEIO_STATUS.CONCLUIDO
            ? TANQUE_HIST_TIPO.ENTREGA_ELETRICISTA
            : 'eletricista_baixa'

        await addDoc(collection(db, 'tanques', tanqueParaHistorico, 'historico'), {
          texto,
          tipo: tipoHist,
          pedidoId: item.pedidoId,
          romaneioId: romaneio.id,
          producerName: item.producerNameSnapshot || '',
          eletricistaNome,
          compradorNome: compradorNome || null,
          motivoSolicitacao,
          tipoPedidoLabel: tipoPedidoLabel || null,
          dataEntregaRegisto: serverTimestamp(),
          fotos,
          createdAt: serverTimestamp(),
        })
      }

      if (item.pedidoId && st === ITEM_ROMANEIO_STATUS.CONCLUIDO) {
        await updateDoc(doc(db, 'pedidos', item.pedidoId), {
          status: PEDIDO_STATUS.CONCLUIDO,
          updatedAt: serverTimestamp(),
        })
      }

      if (tanqueParaHistorico && st === ITEM_ROMANEIO_STATUS.CONCLUIDO) {
        await updateDoc(doc(db, 'tanques', tanqueParaHistorico), {
          vinculoRomaneioId: null,
          updatedAt: serverTimestamp(),
        })
      }

      // Recarrega o romaneio para garantir que a UI reflita imediatamente a gravação.
      const freshSnap = await getDoc(doc(db, 'romaneios', romaneio.id))
      if (freshSnap.exists()) {
        setRomaneio({ id: freshSnap.id, ...freshSnap.data() })
      } else {
        // Fallback (não deveria acontecer) para evitar ficar “sem update”.
        setRomaneio((prev) => ({ ...prev, itens: newItens, status: rStatus }))
      }

      setEdits((prev) => ({
        ...prev,
        [item.id]: {
          ...(prev[item.id] || {}),
          status: st,
          notasEletricista: notas,
          files: [],
        },
      }))
      toast.success('Baixa registada.')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao guardar.')
    }
  }

  if (loading) return <p className="text-slate-600">A carregar…</p>
  if (!romaneio) return <p className="text-red-600">Romaneio não encontrado ou sem permissão.</p>

  const { total, feitos, concluidosInstalacao } = romaneioProgress(romaneio.itens)
  const prazoRomaneioAtrasado = romaneioUltrapassouPrazo(romaneio)

  const statusCards = useMemo(() => {
    const list = romaneio?.itens || []
    const counts = {}
    for (const it of list) {
      const st = edits[it.id]?.status ?? it.status
      counts[st] = (counts[st] || 0) + 1
    }
    const cards = [
      { id: 'all', label: 'Todos', count: list.length, style: 'border-slate-200 bg-slate-50 text-slate-800' },
      {
        id: ITEM_ROMANEIO_STATUS.PENDENTE,
        label: ITEM_ROMANEIO_STATUS_LABELS[ITEM_ROMANEIO_STATUS.PENDENTE],
        count: counts[ITEM_ROMANEIO_STATUS.PENDENTE] || 0,
        style: 'border-amber-200 bg-amber-50 text-amber-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.EM_ANDAMENTO,
        label: ITEM_ROMANEIO_STATUS_LABELS[ITEM_ROMANEIO_STATUS.EM_ANDAMENTO],
        count: counts[ITEM_ROMANEIO_STATUS.EM_ANDAMENTO] || 0,
        style: 'border-blue-200 bg-blue-50 text-blue-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.CONCLUIDO,
        label: ITEM_ROMANEIO_STATUS_LABELS[ITEM_ROMANEIO_STATUS.CONCLUIDO],
        count: counts[ITEM_ROMANEIO_STATUS.CONCLUIDO] || 0,
        style: 'border-green-200 bg-green-50 text-green-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR,
        label: ITEM_ROMANEIO_STATUS_LABELS[ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR],
        count: counts[ITEM_ROMANEIO_STATUS.INCOMPLETO_REAGENDAR] || 0,
        style: 'border-amber-200 bg-amber-50 text-amber-900',
      },
      {
        id: ITEM_ROMANEIO_STATUS.CANCELADO,
        label: ITEM_ROMANEIO_STATUS_LABELS[ITEM_ROMANEIO_STATUS.CANCELADO],
        count: counts[ITEM_ROMANEIO_STATUS.CANCELADO] || 0,
        style: 'border-red-200 bg-red-50 text-red-900',
      },
    ]
    return cards
  }, [romaneio?.itens, edits])

  const itensFiltrados = useMemo(() => {
    const list = romaneio?.itens || []
    if (statusFilter === 'all') return list
    return list.filter((it) => (edits[it.id]?.status ?? it.status) === statusFilter)
  }, [romaneio?.itens, edits, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          <div className="mt-3 flex flex-wrap items-baseline gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {feitos}/{total}
            </p>
            <p className="text-sm text-slate-600">
              pedidos com baixa registada · <span className="font-medium">{concluidosInstalacao}</span> instalação(ões)
              concluída(s)
            </p>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Por cada produtor: escolha o estado, escreva a baixa, anexe fotos quando concluir ou pedir reagendamento, e
            guarde. O gestor vê o mesmo romaneio em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/eletricista/romaneios')}
          className="text-sm text-blue-800 underline"
        >
          Voltar à lista
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

      <ul className="space-y-6">
        {(itensFiltrados || []).map((item) => {
          const ped = pedidos[item.pedidoId]
          const ed = edits[item.id] || {}
          const statusEfetivo = ed.status ?? item.status
          const visitaEmAberto =
            statusEfetivo !== ITEM_ROMANEIO_STATUS.CONCLUIDO &&
            statusEfetivo !== ITEM_ROMANEIO_STATUS.CANCELADO
          const mostrarBolinhaAtraso = prazoRomaneioAtrasado && visitaEmAberto
          const isConcluido = statusEfetivo === ITEM_ROMANEIO_STATUS.CONCLUIDO
          return (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {isConcluido ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800"
                    title="Baixa marcada como concluída"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Concluído
                  </span>
                ) : null}
                <h2 className="font-semibold text-slate-900">
                  {item.producerNameSnapshot || ped?.producerName || 'Produtor'}
                </h2>
                {mostrarBolinhaAtraso ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                    title="Prazo do romaneio ultrapassado — esta visita ainda não está concluída."
                  >
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                    </span>
                    Atraso
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">
                Tanque (romaneio):{' '}
                {item.tanqueId
                  ? `${item.tanqueId.slice(0, 8)}…`
                  : ped?.tanqueId
                    ? `${ped.tanqueId.slice(0, 8)}… (pedido)`
                    : '—'}
              </p>
              {ped && (
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Localização do pedido</p>
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

              {ped && (ped.notes || '').trim() ? (
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">
                    Notas do comprador
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{ped.notes}</p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-sm font-medium">Estado da manutenção</label>
                  <SearchableSelect
                    value={ed.status ?? item.status}
                    onChange={(v) => setEdit(item.id, 'status', v)}
                    options={ITEM_STATUS_OPTIONS}
                    placeholder="Estado"
                    title="Estado da baixa"
                    className="mt-1 max-w-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Notas / baixa</label>
                  <textarea
                    value={ed.notasEletricista ?? item.notasEletricista ?? ''}
                    onChange={(e) => setEdit(item.id, 'notasEletricista', e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Fotos (obrigatório ao concluir ou reagendar)
                  </label>
                  <EletricistaItemFotos
                    files={ed.files || []}
                    onFilesChange={(next) => setEdit(item.id, 'files', next)}
                    existingUrls={item.fotos || []}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Histórico desta visita
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Registo automático ao guardar: data, estado da manutenção e um excerto das notas (quando existir).
                  </p>
                  {Array.isArray(item.historicoBaixa) && item.historicoBaixa.length > 0 ? (
                    <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pr-1">
                      {[...item.historicoBaixa].reverse().map((h, idx) => (
                        <li
                          key={`${item.id}-h-${idx}-${h.at}`}
                          className="border-l-2 border-blue-400 pl-3 text-xs text-slate-700"
                        >
                          <span className="font-medium text-slate-900">{formatHistoricoAt(h.at)}</span>
                          <span className="text-slate-500"> · </span>
                          <span>{h.estadoLabel || h.estado || '—'}</span>
                          {h.notasTrecho ? (
                            <span className="mt-1 block text-slate-600 line-clamp-3">
                              «{h.notasTrecho}
                              {h.notasCortado || h.notasTrecho.length >= 120 ? '…' : ''}»
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Ainda sem histórico. Quando guardar a baixa, aparece aqui o estado e o resumo das notas para
                      acompanhar o pedido.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => saveItem(item)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <span className="inline-flex items-center gap-2">
                    {isConcluido ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Concluído
                      </>
                    ) : (
                      'Guardar baixa deste pedido'
                    )}
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
