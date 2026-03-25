import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { isAfter } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { ITEM_ROMANEIO_STATUS, ROMANEIO_STATUS } from '../../constants/roles'

function tsToDate(v) {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

export default function EletricistaDashboard() {
  const { profile } = useAuth()
  const [romaneios, setRomaneios] = useState([])

  useEffect(() => {
    if (!profile?.id) return undefined
    const q = query(collection(db, 'romaneios'), where('eletricistaId', '==', profile.id))
    return onSnapshot(q, (s) => {
      setRomaneios(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [profile?.id])

  const { abertos, concluidos } = useMemo(() => {
    let abertos = 0
    let concluidos = 0
    for (const r of romaneios) {
      for (const it of r.itens || []) {
        if (it.status === ITEM_ROMANEIO_STATUS.CONCLUIDO || it.status === ITEM_ROMANEIO_STATUS.CANCELADO) {
          concluidos++
        } else {
          abertos++
        }
      }
    }
    return { abertos, concluidos }
  }, [romaneios])

  const romaneiosAtrasados = useMemo(() => {
    const now = new Date()
    return romaneios.filter((r) => {
      const fim = tsToDate(r.dataFim)
      if (!fim) return false
      if (r.status === ROMANEIO_STATUS.CONCLUIDO || r.status === ROMANEIO_STATUS.CANCELADO) return false
      return isAfter(now, fim)
    })
  }, [romaneios])

  const itensAtraso = useMemo(() => {
    let n = 0
    const ids = new Set(romaneiosAtrasados.map((r) => r.id))
    for (const r of romaneios) {
      if (!ids.has(r.id)) continue
      for (const it of r.itens || []) {
        if (it.status === ITEM_ROMANEIO_STATUS.CONCLUIDO || it.status === ITEM_ROMANEIO_STATUS.CANCELADO) continue
        n++
      }
    }
    return n
  }, [romaneios, romaneiosAtrasados])

  const temAtraso = romaneiosAtrasados.length > 0

  return (
    <div className="space-y-6">
      <div>
        <PageTitleWithHelp title="Painel do eletricista" tooltipId="help-eletricista-painel">
          <p>
            O <strong>gestor</strong> monta <strong>romaneios</strong> (visitas por produtor: pedido e tanque). Neste
            painel vê quantas <strong>linhas</strong> ainda precisam de baixa (estado, fotos, notas de campo) e quantas já
            fechou. Use <strong>Romaneios</strong> para abrir cada lista, ver a rota e o mapa de cada propriedade. Se a{' '}
            <strong>data fim</strong> do romaneio já passou e a lista não está concluída, aparece aqui o aviso de{' '}
            <strong>atraso</strong>.
          </p>
        </PageTitleWithHelp>
        <p className="mt-2 max-w-3xl text-slate-600">
          Resumo das visitas em romaneio e alerta quando o <strong>prazo (data fim)</strong> de uma lista já passou.
        </p>
      </div>

      {temAtraso ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-800">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-red-950">Tem trabalhos em atraso</p>
              <p className="mt-1 text-sm text-red-900/90">
                {romaneiosAtrasados.length === 1
                  ? '1 romaneio ultrapassou a data fim e ainda não está concluído.'
                  : `${romaneiosAtrasados.length} romaneios ultrapassaram a data fim e ainda não estão concluídos.`}
                {itensAtraso > 0 ? (
                  <>
                    {' '}
                    <span className="font-medium">
                      {itensAtraso === 1
                        ? 'Falta 1 visita em aberto nesse(s) prazo(s).'
                        : `Faltam ${itensAtraso} visitas em aberto nesse(s) prazo(s).`}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <Link
            to="/eletricista/romaneios"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-red-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-900"
          >
            Ver romaneios
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-900">Itens em aberto / pendente</p>
          <p className="mt-2 text-4xl font-bold text-amber-950">{abertos}</p>
          <Link to="/eletricista/romaneios" className="mt-3 inline-block text-sm font-medium text-amber-800 underline">
            Ver romaneios
          </Link>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <p className="text-sm font-medium text-blue-900">Itens concluídos ou cancelados</p>
          <p className="mt-2 text-4xl font-bold text-blue-950">{concluidos}</p>
          <Link to="/eletricista/trabalhos" className="mt-3 inline-block text-sm font-medium text-blue-800 underline">
            Lista de trabalhos
          </Link>
        </div>
        <div
          className={`rounded-xl border p-6 sm:col-span-2 lg:col-span-1 ${
            temAtraso
              ? 'border-red-300 bg-red-50'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <p className={`text-sm font-medium ${temAtraso ? 'text-red-900' : 'text-slate-700'}`}>
            Romaneios em atraso (prazo)
          </p>
          <p className={`mt-2 text-4xl font-bold ${temAtraso ? 'text-red-950' : 'text-slate-400'}`}>
            {romaneiosAtrasados.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Data fim já passou e o romaneio não está concluído ou cancelado.
          </p>
          <Link
            to="/eletricista/romaneios"
            className={`mt-3 inline-block text-sm font-medium underline ${
              temAtraso ? 'text-red-800' : 'text-slate-600'
            }`}
          >
            Ver romaneios
          </Link>
        </div>
      </div>
    </div>
  )
}
