import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { Bell, X, AlertTriangle, Calendar, ChevronRight } from 'lucide-react'
import { format, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { db } from '../firebase/config'
import { ROMANEIO_STATUS } from '../constants/roles'

const PER_PAGE = 5

function tsToDate(v) {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}

export default function GestorRomaneiosAtrasoBell() {
  const [romaneios, setRomaneios] = useState([])
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'romaneios'), orderBy('dataInicio', 'desc')), (s) =>
      setRomaneios(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
    return () => unsub()
  }, [])

  const atrasados = useMemo(() => {
    const now = new Date()
    return romaneios.filter((r) => {
      const fim = tsToDate(r.dataFim)
      if (!fim) return false
      if (r.status === ROMANEIO_STATUS.CONCLUIDO || r.status === ROMANEIO_STATUS.CANCELADO) return false
      return isAfter(now, fim)
    })
  }, [romaneios])

  const totalPages = Math.max(1, Math.ceil(atrasados.length / PER_PAGE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const slice = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return atrasados.slice(start, start + PER_PAGE)
  }, [atrasados, page])

  if (atrasados.length === 0) return null

  return (
    <>
      <div className="pointer-events-none fixed right-3 top-16 z-[55] md:right-6 md:top-6">
        <button
          type="button"
          onClick={() => {
            setPage(1)
            setOpen(true)
          }}
          className="pointer-events-auto relative flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-2 ring-red-300/80 transition hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 animate-pulse"
          aria-label={`Romaneios em atraso: ${atrasados.length}. Abrir lista.`}
        >
          <Bell className="h-5 w-5" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
            {atrasados.length > 99 ? '99+' : atrasados.length}
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestor-atraso-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 flex max-h-[min(88vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80">
              <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 pb-4 pt-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                  aria-hidden
                >
                  <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="gestor-atraso-title" className="text-lg font-semibold tracking-tight text-slate-900">
                      Romaneios em atraso
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-800">
                      {atrasados.length}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    A data de fim já passou e a lista não está concluída. Contacte o eletricista ou replaneje a rota.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
                {slice.map((r) => {
                  const fimStr = r.dataFim ? format(tsToDate(r.dataFim), 'dd/MM/yyyy', { locale: ptBR }) : '—'
                  const titulo = (r.titulo || '').trim() || `Romaneio ${r.id.slice(0, 8)}…`
                  return (
                    <li key={r.id}>
                      <Link
                        to={`/gestor/romaneio/${r.id}`}
                        className="group flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100/80"
                        onClick={() => setOpen(false)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 transition-colors group-hover:text-blue-700">
                            {titulo}
                          </p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span>
                                Fim previsto:{' '}
                                <time dateTime={r.dataFim?.toDate ? r.dataFim.toDate().toISOString() : undefined}>
                                  {fimStr}
                                </time>
                              </span>
                            </span>
                          </p>
                        </div>
                        <ChevronRight
                          className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-4 py-3.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Anterior
                  </button>
                  <span className="text-sm tabular-nums text-slate-600">
                    Página <span className="font-semibold text-slate-800">{page}</span> de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Seguinte
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
