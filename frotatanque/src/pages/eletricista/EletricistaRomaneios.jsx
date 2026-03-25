import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { romaneioProgress } from '../../utils/romaneio'
import { ROMANEIO_STATUS_LABELS } from '../../constants/roles'

export default function EletricistaRomaneios() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!profile?.id) return undefined
    const q = query(collection(db, 'romaneios'), where('eletricistaId', '==', profile.id))
    return onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setRows(list)
    })
  }, [profile?.id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Os meus romaneios</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Listas atribuídas a si com <strong>data de início e fim</strong>. Em cada uma, trate pedido a pedido: concluir,
          reportar incompleto para reagendar ou cancelar, com fotos quando exigido. O progresso abaixo atualiza quando
          guarda baixas.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.length === 0 && <li className="text-slate-500">Sem romaneios atribuídos.</li>}
        {rows.map((r) => {
          const { total, feitos, concluidosInstalacao } = romaneioProgress(r.itens)
          return (
            <li key={r.id}>
              <Link
                to={`/eletricista/romaneios/${r.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{r.titulo || 'Romaneio'}</p>
                    <p className="text-sm text-slate-600">
                      {r.dataInicio?.toDate
                        ? format(r.dataInicio.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                        : ''}{' '}
                      →{' '}
                      {r.dataFim?.toDate
                        ? format(r.dataFim.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Estado da lista: {ROMANEIO_STATUS_LABELS[r.status] || r.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {feitos}/{total}
                    </p>
                    <p className="text-xs text-slate-500">
                      com baixa · {concluidosInstalacao} instalação(ões) concluída(s)
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
