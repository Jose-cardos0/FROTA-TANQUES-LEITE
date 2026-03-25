import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Substitui &lt;select&gt;: botão que abre **sempre um modal** com campo de pesquisa e lista filtrada.
 * @param {{ value: string, label: string }[]} options
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = '— Selecionar —',
  searchPlaceholder = 'Filtrar lista…',
  /** Título no topo do modal (por defeito: aria-label ou «Selecionar») */
  title: titleProp,
  modalTitle,
  disabled = false,
  className = '',
  buttonClassName = '',
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const portalId = useId().replace(/:/g, '')
  const searchRef = useRef(null)

  const headerTitle = useMemo(() => {
    if (titleProp != null && String(titleProp).trim() !== '') return String(titleProp).trim()
    if (modalTitle != null && String(modalTitle).trim() !== '') return String(modalTitle).trim()
    if (ariaLabel) return ariaLabel
    const p = (placeholder || '').trim()
    if (p && !/^—/.test(p)) return p
    return 'Selecionar'
  }, [titleProp, modalTitle, ariaLabel, placeholder])

  const filtered = useMemo(() => {
    const q = norm(search).trim()
    if (!q) return options
    return options.filter(
      (o) => norm(o.label).includes(q) || norm(o.value).includes(q),
    )
  }, [options, search])

  const selectedLabel = useMemo(() => {
    const f = options.find((o) => o.value === value)
    return f?.label ?? placeholder
  }, [options, value, placeholder])

  function close() {
    setOpen(false)
    setSearch('')
  }

  function openModal() {
    if (disabled) return
    setSearch('')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => searchRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function pick(v) {
    onChange(v)
    close()
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => (open ? close() : openModal())}
        className={`flex min-h-[44px] w-full touch-manipulation items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={value === '' || value == null ? 'text-slate-500' : ''}>{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-4"
            role="presentation"
            id={`ssp-modal-${portalId}`}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
              aria-label="Fechar"
              onClick={close}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`ssp-h-${portalId}`}
              className="relative z-10 flex max-h-[min(88vh,34rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/90 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 pb-3 pt-4 sm:px-5">
                <h2 id={`ssp-h-${portalId}`} className="pr-2 text-base font-semibold leading-snug text-slate-900">
                  {headerTitle}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              <div className="shrink-0 border-b border-slate-100 px-3 pb-3 pt-2 sm:px-4">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"
                    autoComplete="off"
                    autoCorrect="off"
                  />
                </div>
              </div>

              <ul
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
              >
                {filtered.length === 0 ? (
                  <li className="rounded-lg px-3 py-8 text-center text-sm text-slate-500">
                    Nenhum resultado com este filtro.
                  </li>
                ) : (
                  filtered.map((o) => (
                    <li key={o.value === '' ? '__empty__' : String(o.value)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={o.value === value}
                        onClick={() => pick(o.value)}
                        className={`mb-0.5 w-full rounded-xl px-3 py-3 text-left text-sm transition sm:py-2.5 ${
                          o.value === value
                            ? 'bg-blue-50 font-semibold text-blue-900 ring-1 ring-blue-100'
                            : 'text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                        }`}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
