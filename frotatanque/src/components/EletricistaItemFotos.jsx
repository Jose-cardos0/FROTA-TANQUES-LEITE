import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, X } from 'lucide-react'

function PendingThumb({ file, onRemove }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  return (
    <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-slate-400">…</div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/75 text-white opacity-0 shadow transition hover:bg-red-700 group-hover:opacity-100"
        aria-label="Remover foto da fila"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Fotos já guardadas (URLs) + fila de ficheiros novos antes de guardar a baixa.
 */
export default function EletricistaItemFotos({ files, onFilesChange, existingUrls }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const urls = existingUrls || []

  function addFromList(fileList) {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (incoming.length === 0) return
    onFilesChange([...files, ...incoming])
  }

  function removePending(index) {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (e.currentTarget.contains(e.relatedTarget)) return
          setDragOver(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFromList(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? 'border-blue-500 bg-blue-50/80'
            : 'border-slate-300 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/50'
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
          <ImagePlus className="h-5 w-5 text-blue-700" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-800">
            Toque para escolher ou largue fotos aqui
          </p>
          <p className="mt-0.5 text-xs text-slate-500">PNG, JPG — várias de uma vez</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            addFromList(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {files.length === 1 ? '1 foto nova' : `${files.length} fotos novas`}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onFilesChange([])
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Limpar fila
          </button>
        </div>
      ) : null}

      {(urls.length > 0 || files.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group relative block h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ring-offset-2 hover:ring-2 hover:ring-blue-400"
            >
              <img src={url} alt="Foto já enviada" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-0.5 text-center text-[10px] font-medium text-white">
                Enviada
              </span>
            </a>
          ))}
          {files.map((f, i) => (
            <PendingThumb key={`${f.name}-${i}-${f.size}`} file={f} onRemove={() => removePending(i)} />
          ))}
        </div>
      )}

      {urls.length === 0 && files.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Nenhuma foto ainda. Ao concluir ou pedir reagendamento, é obrigatório anexar pelo menos uma.
        </p>
      ) : null}
    </div>
  )
}
