import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PEDIDO_STATUS, PEDIDO_TIPO_LABELS, PEDIDO_STATUS_LABELS } from '../../constants/roles'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import HelpTooltipBubble from '../../components/HelpTooltipBubble'
import GestorPedidosMap from '../../components/GestorPedidosMap'

export default function GestorDashboard() {
  const [pedidos, setPedidos] = useState([])
  const [tanques, setTanques] = useState([])
  const [lastPedidosPage, setLastPedidosPage] = useState(1)

  const LAST_PEDIDOS_PAGE_SIZE = 5

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'pedidos'), orderBy('createdAt', 'desc')), (s) =>
      setPedidos(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
    const unsubT = onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
    return () => {
      unsubP()
      unsubT()
    }
  }, [])

  const stats = useMemo(() => {
    const abertos = pedidos.filter((p) => p.status === PEDIDO_STATUS.ABERTO).length
    const vinc = pedidos.filter((p) => p.status === PEDIDO_STATUS.VINCULADO).length
    const emRom = pedidos.filter((p) => p.status === PEDIDO_STATUS.EM_ROMANEIO).length
    const concluidos = pedidos.filter((p) => p.status === PEDIDO_STATUS.CONCLUIDO).length
    const totalPedidos = pedidos.length
    const restantes = totalPedidos - concluidos
    const tanquesDisponiveis = tanques.filter(
      (t) =>
        !t.inutilizado &&
        t.status !== 'manutencao' &&
        (t.status === 'disponivel' || t.status == null || t.status === '') &&
        !t.producerId &&
        !t.vinculoRomaneioId,
    ).length
    return { abertos, vinc, emRom, concluidos, totalPedidos, restantes, tanquesDisponiveis }
  }, [pedidos, tanques])

  const lastPedidosTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil((pedidos?.length || 0) / LAST_PEDIDOS_PAGE_SIZE))
  }, [pedidos])

  useEffect(() => {
    if (lastPedidosPage > lastPedidosTotalPages) setLastPedidosPage(lastPedidosTotalPages)
  }, [lastPedidosPage, lastPedidosTotalPages])

  const lastPedidos = useMemo(() => {
    const start = (lastPedidosPage - 1) * LAST_PEDIDOS_PAGE_SIZE
    const end = start + LAST_PEDIDOS_PAGE_SIZE
    return pedidos.slice(start, end)
  }, [pedidos, lastPedidosPage])

  const chartData = useMemo(
    () => [
      { nome: 'Abertos', valor: stats.abertos },
      { nome: 'C/ tanque', valor: stats.vinc },
      { nome: 'Romaneio', valor: stats.emRom },
      { nome: 'Concluídos', valor: stats.concluidos },
    ],
    [stats],
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Painel do gestor</h1>
    
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            kind: 'link',
            label: 'Pedidos abertos',
            hint: 'Ainda sem tanque na frota',
            value: stats.abertos,
            to: '/gestor/pedidos',
            color: 'bg-amber-50 text-amber-900',
          },
          {
            kind: 'link',
            label: 'Com tanque vinculado',
            hint: 'Prontos para romaneio',
            value: stats.vinc,
            to: '/gestor/pedidos',
            color: 'bg-emerald-50 text-emerald-900',
          },
          {
            kind: 'relacao',
            label: 'Relação de pedidos',
            color: 'bg-white text-slate-900 border border-slate-200',
          },
          {
            kind: 'link',
            label: 'Em romaneio',
            hint: 'Na rota do eletricista',
            value: stats.emRom,
            to: '/gestor/romaneio',
            color: 'bg-violet-50 text-violet-900',
          },
          {
            kind: 'link',
            label: 'Tanques livres',
            hint: 'Disponíveis na frota (sem manutenção ativa)',
            value: stats.tanquesDisponiveis,
            to: '/gestor/tanques',
            color: 'bg-blue-50 text-blue-900',
          },
        ].map((c) =>
          c.kind === 'relacao' ? (
            <div key={c.label} className={`relative rounded-xl p-4 shadow-sm ${c.color}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium opacity-90">{c.label}</p>
                <HelpTooltipBubble
                  tooltipId="tooltip-relacao-pedidos"
                  ariaLabel="O que significa este indicador"
                >
                  <p className="font-medium text-slate-900">Relação de pedidos</p>
                  <p className="mt-2">
                    O número <span className="font-semibold text-emerald-600">verde</span> é a quantidade de pedidos{' '}
                    <strong>concluídos</strong>. O número <span className="font-semibold text-red-600">vermelho</span>{' '}
                    é o <strong>total</strong> de pedidos registados na app.
                  </p>
                  <p className="mt-2 text-slate-600">
                    A diferença (total − concluídos) corresponde a pedidos ainda em curso: abertos, com tanque, em
                    romaneio, etc.
                  </p>
                </HelpTooltipBubble>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-600">{stats.concluidos}</span>
                <span className="text-2xl font-bold text-slate-400">/</span>
                <span className="text-3xl font-bold text-red-600">{stats.totalPedidos}</span>
              </div>
            </div>
          ) : (
            <Link
              key={c.label}
              to={c.to}
              className={`rounded-xl border border-slate-200 p-4 shadow-sm transition hover:shadow-md ${c.color}`}
            >
              <p className="text-sm font-medium opacity-90">{c.label}</p>
              <p className="mt-0.5 text-xs opacity-75">{c.hint}</p>
              <p className="mt-2 text-3xl font-bold">{c.value}</p>
            </Link>
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Pedidos — visão rápida</h2>
          <p className="mb-4 text-xs text-slate-500">Distribuição por fase (últimos registos na tabela abaixo).</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Pedidos no mapa</h2>
         
          <div className="min-h-64 flex-1">
            <GestorPedidosMap pedidos={pedidos} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Últimos pedidos</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/gestor/pedidos" className="text-sm font-medium text-blue-700 underline">
              Ver lista completa
            </Link>
            <div className="text-xs text-slate-500">
              Página {lastPedidosPage} / {lastPedidosTotalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={lastPedidosPage <= 1}
                onClick={() => setLastPedidosPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={lastPedidosPage >= lastPedidosTotalPages}
                onClick={() => setLastPedidosPage((p) => Math.min(lastPedidosTotalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2">Produtor</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Estado</th>
                <th className="min-w-[8rem] max-w-[12rem] px-4 py-2">Notas</th>
                <th className="px-4 py-2">Comprador editou</th>
              </tr>
            </thead>
            <tbody>
              {lastPedidos.map((p) => {
                const notas = (p.notes || '').trim()
                return (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium">{p.producerName}</td>
                    <td className="px-4 py-2">{PEDIDO_TIPO_LABELS[p.tipoPedido] || p.tipoPedido || '—'}</td>
                    <td className="px-4 py-2">{PEDIDO_STATUS_LABELS[p.status] || p.status}</td>
                    <td className="max-w-[12rem] px-4 py-2">
                      {notas ? (
                        <span className="line-clamp-2 text-slate-600" title={notas}>
                          {notas}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{p.lastCompradorEditAt ? 'Sim' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
