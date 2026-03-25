import HelpTooltipBubble from './HelpTooltipBubble'

/**
 * Título de página com ícone ? e tooltip (hover/foco) para a descrição.
 */
export default function PageTitleWithHelp({ title, tooltipId, children }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <HelpTooltipBubble
        tooltipId={tooltipId}
        ariaLabel={`O que é a página «${title}»`}
      >
        {children}
      </HelpTooltipBubble>
    </div>
  )
}
