import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { ITEM_ROMANEIO_STATUS, ITEM_ROMANEIO_STATUS_LABELS } from '../../constants/roles'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function EletricistaTrabalhos() {
  const { profile } = useAuth()
  const [romaneios, setRomaneios] = useState([])
  const [tab, setTab] = useState('abertos')

  useEffect(() => {
    if (!profile?.id) return undefined
    const q = query(collection(db, 'romaneios'), where('eletricistaId', '==', profile.id))
    return onSnapshot(q, (s) => {
      setRomaneios(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [profile?.id])

  const linhas = useMemo(() => {
    const out = []
    for (const r of romaneios) {
      for (const it of r.itens || []) {
        const terminal = [
          ITEM_ROMANEIO_STATUS.CONCLUIDO,
          ITEM_ROMANEIO_STATUS.CANCELADO,
        ].includes(it.status)
        out.push({
          romaneioId: r.id,
          romaneioTitulo: r.titulo,
          item: it,
          terminal,
        })
      }
    }
    return out
  }, [romaneios])

  const filtrados = useMemo(() => {
    if (tab === 'abertos') {
      return linhas.filter((l) => !l.terminal)
    }
    if (tab === 'concluidos') {
      return linhas.filter((l) => l.terminal)
    }
    return linhas
  }, [linhas, tab])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trabalhos</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Todas as <strong>linhas</strong> dos seus romaneios numa só tabela: filtre o que falta fazer ou o que já
          encerrou. Use <strong>Abrir</strong> para voltar ao romaneio, mapa e formulário de baixa.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('abertos')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'abertos' ? 'bg-blue-600 text-white' : 'bg-slate-200'
          }`}
        >
          Em aberto
        </button>
        <button
          type="button"
          onClick={() => setTab('concluidos')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'concluidos' ? 'bg-blue-600 text-white' : 'bg-slate-200'
          }`}
        >
          Concluídos / cancelados
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Romaneio</th>
              <th className="px-4 py-2">Produtor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Conclusão</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nada neste separador. Veja <Link className="text-blue-700 underline" to="/eletricista/romaneios">Os meus romaneios</Link>.
                </td>
              </tr>
            )}
            {filtrados.map((row) => (
              <tr key={`${row.romaneioId}-${row.item.id}`} className="border-b border-slate-100">
                <td className="px-4 py-2">{row.romaneioTitulo || row.romaneioId.slice(0, 8)}</td>
                <td className="px-4 py-2">{row.item.producerNameSnapshot}</td>
                <td className="px-4 py-2">
                  {ITEM_ROMANEIO_STATUS_LABELS[row.item.status] || row.item.status}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.item.completedAt?.toDate
                    ? format(row.item.completedAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : '—'}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/eletricista/romaneios/${row.romaneioId}`}
                    className="text-blue-700 underline"
                  >
                    Abrir
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
