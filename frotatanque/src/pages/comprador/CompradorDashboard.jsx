import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PlusCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import HelpTooltipBubble from '../../components/HelpTooltipBubble'
import {
  PEDIDO_STATUS,
  PEDIDO_TIPO_LABELS,
  PEDIDO_STATUS_LABELS,
} from '../../constants/roles'

const tipoLabel = PEDIDO_TIPO_LABELS
const statusLabel = {
  ...PEDIDO_STATUS_LABELS,
  [PEDIDO_STATUS.VINCULADO]: 'Em processamento',
}

export default function CompradorDashboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('todos')

  const visibleRows = useMemo(() => {
    if (tab === 'recusados') return rows.filter((p) => p.status === PEDIDO_STATUS.CANCELADO)
    return rows
  }, [rows, tab])

  useEffect(() => {
    if (!profile?.id) return undefined
    const q = query(
      collection(db, 'pedidos'),
      where('compradorId', '==', profile.id),
    )
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()
          return (tb || 0) - (ta || 0)
        })
        setRows(list)
      },
      (err) => {
        console.error(err)
        if (err?.code === 'failed-precondition') {
          toast.error('Índice do Firestore em falta para listar pedidos. Avise o gestor para criar/publicar o índice.')
        }
      },
    )
  }, [profile?.id])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[18rem]">
          <PageTitleWithHelp title="Os meus pedidos" tooltipId="help-comprador-meus-pedidos">
            <p className="max-w-2xl">
              Pedidos de instalação, troca, remoção ou manutenção. O <strong>gestor</strong> associa tanques da
              frota e pode incluir o seu pedido num romaneio para o eletricista executar. Pode <strong>editar</strong>{' '}
              enquanto o estado o permitir — as alterações ficam no histórico. Se o pedido for <strong>recusado</strong>,
              o motivo aparece e pode reenviar ao gestor.
            </p>
          </PageTitleWithHelp>
          <p className="mt-2 max-w-2xl text-slate-600">
            Veja o estado dos seus pedidos, o motivo de recusa (quando existir) e reenvie quando necessário.
          </p>
        </div>
        <Link
          to="/comprador/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          Novo pedido
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'recusados', label: 'Recusados' },
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
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Produtor</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Tipo</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Volume (L)</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Data pedido</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Notas</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Ainda não tem pedidos. Crie o primeiro.
                </td>
              </tr>
            )}
            {visibleRows.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium">{p.producerName}</td>
                <td className="px-4 py-3">{tipoLabel[p.tipoPedido] || p.tipoPedido}</td>
                <td className="px-4 py-3">{p.volumeLitros}</td>
                <td className="px-4 py-3">
                  {p.orderDate
                    ? format(typeof p.orderDate === 'string' ? new Date(p.orderDate) : p.orderDate.toDate?.() || new Date(), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </td>
                <td className="max-w-[200px] px-4 py-3 text-slate-600">
                  {p.status === PEDIDO_STATUS.CANCELADO && p.refusedReason?.trim() ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800">
                          Motivo da recusa
                        </span>
                        <HelpTooltipBubble tooltipId={`motivo-recusa-${p.id}`} ariaLabel="Motivo da recusa">
                          {p.refusedReason}
                        </HelpTooltipBubble>
                      </div>
                      <span className="line-clamp-2 text-sm" title={p.refusedReason}>
                        {p.refusedReason}
                      </span>
                    </div>
                  ) : p.notes?.trim() ? (
                    <span className="line-clamp-2 text-sm" title={p.notes}>
                      {p.notes}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const cls =
                      p.status === PEDIDO_STATUS.ABERTO
                        ? 'bg-blue-50 text-blue-800'
                        : p.status === PEDIDO_STATUS.VINCULADO
                          ? 'bg-amber-50 text-amber-900'
                          : p.status === PEDIDO_STATUS.EM_ROMANEIO
                            ? 'bg-indigo-50 text-indigo-900'
                            : p.status === PEDIDO_STATUS.CONCLUIDO
                              ? 'bg-green-50 text-green-900'
                              : p.status === PEDIDO_STATUS.CANCELADO
                                ? 'bg-red-50 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                    return (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/comprador/pedido/${p.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {p.status === PEDIDO_STATUS.CANCELADO ? 'Ver / reenviar' : 'Ver / editar'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
