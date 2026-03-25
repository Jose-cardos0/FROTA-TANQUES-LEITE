import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GAP = 8
const MAX_W = 352 // ~22rem

/**
 * Botão ? com tooltip em portal (fixed), para não ser cortado por overflow do layout (ex.: main overflow-x-hidden).
 */
export default function HelpTooltipBubble({ children, ariaLabel, tooltipId }) {
  const fallbackId = useId()
  const id = tooltipId || fallbackId
  const btnRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(() => ({ top: 0, left: 0, width: MAX_W }))
  const hideTimer = useRef(null)

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = window.setTimeout(() => setVisible(false), 180)
  }, [clearHide])

  const updatePosition = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.min(MAX_W, window.innerWidth - 16)
    let left = r.left
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - w)
    if (left < 8) left = 8
    setPos({ top: r.bottom + GAP, left, width: w })
  }, [])

  const show = useCallback(() => {
    clearHide()
    const el = btnRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const w = Math.min(MAX_W, window.innerWidth - 16)
      let left = r.left
      if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - w)
      if (left < 8) left = 8
      setPos({ top: r.bottom + GAP, left, width: w })
    }
    setVisible(true)
  }, [clearHide])

  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [visible, updatePosition])

  useEffect(
    () => () => {
      clearHide()
    },
    [clearHide],
  )

  return (
    <>
      <div className="relative shrink-0 pt-1">
        <button
          ref={btnRef}
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[11px] font-bold leading-none text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          aria-label={ariaLabel}
          aria-describedby={visible ? id : undefined}
          aria-expanded={visible}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          onFocus={show}
          onBlur={scheduleHide}
        >
          ?
        </button>
      </div>
      {visible &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="pointer-events-auto rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-700 shadow-lg"
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
          >
            <div className="space-y-2 [&_strong]:font-semibold [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline">
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
