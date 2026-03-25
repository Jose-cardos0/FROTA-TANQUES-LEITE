import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ROMANEIO_STATUS_LABELS, ITEM_ROMANEIO_STATUS } from '../../constants/roles'
import { romaneioProgress } from '../../utils/romaneio'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'

export default function GestorChecklists() {
  const [romaneios, setRomaneios] = useState([])
  const [usersById, setUsersById] = useState({})

  useEffect(() => {
    return onSnapshot(collection(db, 'romaneios'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setRomaneios(list)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (s) => {
      const m = {}
      s.docs.forEach((d) => {
        m[d.id] = d.data()
      })
      setUsersById(m)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <PageTitleWithHelp title="Checklists e romaneios" tooltipId="help-gestor-checklists">
          <p>
            Cada linha é uma <strong>lista de visitas</strong> atribuída a um eletricista: pedidos × tanques por
            produtor. Acompanhe o <strong>progresso das baixas</strong> (o eletricista regista estado, fotos e notas em
            cada pedido). Para detalhes ou ajustes, abra o romaneio.
          </p>
        </PageTitleWithHelp>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Romaneio</th>
              <th className="px-4 py-2">Eletricista</th>
              <th className="px-4 py-2">Período</th>
              <th className="px-4 py-2">Estado lista</th>
              <th className="px-4 py-2">Progresso</th>
              <th className="px-4 py-2">Itens</th>
            </tr>
          </thead>
          <tbody>
            {romaneios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Ainda não há romaneios. Crie listas em <Link className="text-blue-700 underline" to="/gestor/romaneio">Romaneio</Link>.
                </td>
              </tr>
            )}
            {romaneios.map((r) => {
              const e = usersById[r.eletricistaId]
              const itens = r.itens || []
              const pendentes = itens.filter((i) =>
                [ITEM_ROMANEIO_STATUS.PENDENTE, ITEM_ROMANEIO_STATUS.EM_ANDAMENTO].includes(i.status),
              ).length
              const { total, feitos, concluidosInstalacao } = romaneioProgress(itens)
              return (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/gestor/romaneio/${r.id}`} className="text-blue-700 hover:underline">
                      {r.titulo || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{e?.displayName || e?.email || r.eletricistaId}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.dataInicio?.toDate
                      ? format(r.dataInicio.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : ''}{' '}
                    –{' '}
                    {r.dataFim?.toDate
                      ? format(r.dataFim.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : ''}
                  </td>
                  <td className="px-4 py-2">{ROMANEIO_STATUS_LABELS[r.status] || r.status}</td>
                  <td className="px-4 py-2 tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {feitos}/{total}
                    </span>
                    <span className="block text-xs text-slate-500">baixas · {concluidosInstalacao} inst. OK</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {itens.length} visitas · {pendentes} pendentes/em curso
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
