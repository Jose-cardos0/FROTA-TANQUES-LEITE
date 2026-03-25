import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Plus, Trash2 } from 'lucide-react'
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import {
  ROLES,
  PEDIDO_STATUS,
  PEDIDO_TIPO_LABELS,
  ROMANEIO_STATUS,
  ITEM_ROMANEIO_STATUS,
  ROMANEIO_STATUS_LABELS,
} from '../../constants/roles'
import {
  bindTanqueViaRomaneio,
  fetchUserDisplayName,
  resolveProducerIdFromPedido,
  revertTanqueRomaneioPendente,
} from '../../services/tanqueLifecycle'
import { toast } from 'react-toastify'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { romaneioProgress } from '../../utils/romaneio'
import SearchableSelect from '../../components/SearchableSelect'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'

export default function GestorRomaneio() {
  const [romaneios, setRomaneios] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [tanques, setTanques] = useState([])
  const [produtores, setProdutores] = useState([])
  const [eletricistas, setEletricistas] = useState([])
  const [titulo, setTitulo] = useState('')
  const [eletricistaId, setEletricistaId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [linhas, setLinhas] = useState([{ pedidoId: '', tanqueId: '' }])
  const [deletingId, setDeletingId] = useState(null)
  const [novoRomaneioModalOpen, setNovoRomaneioModalOpen] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'romaneios'),
      (s) => {
        const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        setRomaneios(list)
      },
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'pedidos'), (s) =>
      setPedidos(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setProdutores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    async function loadE() {
      const q = query(collection(db, 'users'), where('role', '==', ROLES.ELETRICISTA))
      const s = await getDocs(q)
      setEletricistas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    }
    loadE()
  }, [])

  const eletricistaNome = useMemo(() => {
    const m = {}
    for (const u of eletricistas) m[u.id] = u.displayName || u.email || u.id
    return m
  }, [eletricistas])

  const eletricistaOptions = useMemo(
    () => [
      { value: '', label: '— Selecionar —' },
      ...eletricistas.map((u) => ({ value: u.id, label: u.displayName || u.email })),
    ],
    [eletricistas],
  )

  /** Pedidos em aberto ou já com tanque vinculado ao pedido (fluxo produtor × tanque). */
  const pedidosElegiveis = useMemo(
    () =>
      pedidos.filter(
        (p) => p.status === PEDIDO_STATUS.ABERTO || p.status === PEDIDO_STATUS.VINCULADO,
      ),
    [pedidos],
  )

  /** Tanques que podem entrar na lista (sem produtor, sem romaneio ativo, não inutilizados, fora de manutenção). */
  const tanquesRomaneio = useMemo(
    () =>
      tanques.filter((t) => {
        if (t.inutilizado || t.producerId || t.vinculoRomaneioId) return false
        if (t.status === 'manutencao') return false
        const st = t.status
        return st === 'disponivel' || st == null || st === ''
      }),
    [tanques],
  )

  function pedidosParaSelect(indexLinha) {
    const idAtual = linhas[indexLinha]?.pedidoId
    return pedidosElegiveis.filter((p) => {
      const usadoNoutraLinha = linhas.some((l, i) => i !== indexLinha && l.pedidoId === p.id)
      return !usadoNoutraLinha || p.id === idAtual
    })
  }

  function tanquesParaSelect(indexLinha) {
    const idAtual = linhas[indexLinha]?.tanqueId
    return tanquesRomaneio.filter((t) => {
      const usadoNoutraLinha = linhas.some((l, i) => i !== indexLinha && l.tanqueId === t.id)
      return !usadoNoutraLinha || t.id === idAtual
    })
  }

  function addLinha() {
    setLinhas((l) => [...l, { pedidoId: '', tanqueId: '' }])
  }

  function removeLinha(i) {
    setLinhas((l) => {
      const next = l.filter((_, idx) => idx !== i)
      return next.length ? next : [{ pedidoId: '', tanqueId: '' }]
    })
  }

  function setLinha(i, field, value) {
    setLinhas((lines) => {
      const next = [...lines]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  async function criarRomaneio(e) {
    e.preventDefault()
    if (!titulo.trim()) {
      toast.error('Indique o nome da lista (título).')
      return
    }
    if (!eletricistaId || !dataInicio || !dataFim) {
      toast.error('Preencha eletricista e datas.')
      return
    }
    const validLines = linhas.filter((l) => l.pedidoId && l.tanqueId)
    if (validLines.length === 0) {
      toast.error('Cada linha tem de ter pedido e tanque (tanque disponível na frota e fora de manutenção).')
      return
    }
    const ids = validLines.map((l) => l.pedidoId)
    const tanqueIds = validLines.map((l) => l.tanqueId)
    if (new Set(ids).size !== ids.length) {
      toast.error('Não pode repetir o mesmo pedido na lista.')
      return
    }
    if (new Set(tanqueIds).size !== tanqueIds.length) {
      toast.error('Não pode repetir o mesmo tanque em duas linhas.')
      return
    }

    for (const l of validLines) {
      const tq = tanques.find((t) => t.id === l.tanqueId)
      if (!tq) {
        toast.error('Tanque inválido ou já não existe.')
        return
      }
      if (tq.status === 'manutencao') {
        toast.error(
          `O tanque «${tq.modelo || ''}» está em manutenção. Conclua a manutenção em Tanques antes de o usar num romaneio.`,
        )
        return
      }
      if (tq.inutilizado || tq.producerId || tq.vinculoRomaneioId) {
        toast.error(`O tanque «${tq.modelo || ''}» já não está disponível para novas listas.`)
        return
      }
      const st = tq.status
      if (st != null && st !== '' && st !== 'disponivel') {
        toast.error(`O tanque «${tq.modelo || ''}» tem de estar com estado «disponível» na frota.`)
        return
      }
    }

    const itens = validLines.map((l) => {
      const ped = pedidos.find((p) => p.id === l.pedidoId)
      const producerIdResolved = resolveProducerIdFromPedido(ped, produtores) || ped?.producerId || null
      return {
        id: crypto.randomUUID(),
        pedidoId: l.pedidoId,
        tanqueId: l.tanqueId,
        producerId: producerIdResolved,
        producerNameSnapshot: ped?.producerName || '',
        status: ITEM_ROMANEIO_STATUS.PENDENTE,
        notasEletricista: '',
        fotos: [],
        completedAt: null,
      }
    })

    try {
      const di = new Date(dataInicio)
      const df = new Date(dataFim)
      const docRef = await addDoc(collection(db, 'romaneios'), {
        titulo: titulo.trim(),
        eletricistaId,
        dataInicio: Timestamp.fromDate(di),
        dataFim: Timestamp.fromDate(df),
        status: ROMANEIO_STATUS.PLANEJADO,
        itens,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const romaneioId = docRef.id
      let semProdutorCadastro = 0
      for (const it of itens) {
        const ped = pedidos.find((p) => p.id === it.pedidoId)
        if (!it.producerId) semProdutorCadastro += 1
        const compradorNome = await fetchUserDisplayName(ped?.compradorId)
        await updateDoc(doc(db, 'pedidos', it.pedidoId), {
          status: PEDIDO_STATUS.EM_ROMANEIO,
          tanqueId: it.tanqueId,
          producerId: it.producerId || ped?.producerId || null,
          updatedAt: serverTimestamp(),
        })
        await bindTanqueViaRomaneio({
          tanqueId: it.tanqueId,
          producerId: it.producerId,
          pedidoId: it.pedidoId,
          romaneioId,
          romaneioTitulo: titulo.trim(),
          producerName: it.producerNameSnapshot || ped?.producerName || '',
          compradorNome,
          tipoPedidoLabel: PEDIDO_TIPO_LABELS[ped?.tipoPedido] || ped?.tipoPedido || '',
          motivoSolicitacao: (ped?.notes || '').trim() || null,
        })
      }
      setTitulo('')
      setEletricistaId('')
      setDataInicio('')
      setDataFim('')
      setLinhas([{ pedidoId: '', tanqueId: '' }])
      setNovoRomaneioModalOpen(false)
      if (semProdutorCadastro > 0) {
        toast.warning(
          `${semProdutorCadastro} linha(s) sem produtor correspondente no cadastro — o tanque não ficará na aba «em uso» até vincular manualmente em Produtores/Tanques (nome do pedido deve coincidir com o cadastro).`,
        )
      }
      toast.success('Lista de romaneio criada e atribuída ao eletricista.')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao criar romaneio.')
    }
  }

  async function eliminarRomaneio(r) {
    const n = (r.itens || []).length
    const ok = window.confirm(
      `Eliminar o romaneio "${r.titulo || r.id}" (${n} pedido(s) na lista)?\n\n` +
        'Pedidos ainda em romaneio (trabalho não concluído) voltam a aberto, o tanque é desvinculado do produtor e fica disponível — com entrada no histórico do tanque. Pedidos já concluídos não são alterados.',
    )
    if (!ok) return
    setDeletingId(r.id)
    try {
      for (const it of r.itens || []) {
        if (!it.pedidoId) continue
        const pref = doc(db, 'pedidos', it.pedidoId)
        const ps = await getDoc(pref)
        if (!ps.exists()) continue
        const p = ps.data()
        const pedidoStatus = p.status
        if (it.tanqueId) {
          await revertTanqueRomaneioPendente({
            tanqueId: it.tanqueId,
            pedidoId: it.pedidoId,
            romaneioId: r.id,
            romaneioTitulo: r.titulo || '',
            motivo: 'romaneio_eliminado',
            pedidoStatus,
            itemStatus: it.status,
            producerName: it.producerNameSnapshot || p.producerName || '',
          })
        }
        if (
          p.status === PEDIDO_STATUS.EM_ROMANEIO &&
          it.status !== ITEM_ROMANEIO_STATUS.CONCLUIDO
        ) {
          await updateDoc(pref, {
            status: PEDIDO_STATUS.ABERTO,
            tanqueId: null,
            updatedAt: serverTimestamp(),
          })
        }
      }
      await deleteDoc(doc(db, 'romaneios', r.id))
      toast.success('Romaneio eliminado.')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível eliminar o romaneio.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <PageTitleWithHelp title="Romaneio" tooltipId="help-gestor-romaneio">
          <p>
            O romaneio é um <strong>aglomerado de pedidos</strong>: em cada linha liga <strong>pedido × tanque</strong>{' '}
            (produtor e equipamento). Só aparecem pedidos em aberto ou já com tanque vinculado em{' '}
            <Link to="/gestor/pedidos">Pedidos</Link>; os tanques têm de estar livres, disponíveis e{' '}
            <strong>fora de manutenção</strong> em <Link to="/gestor/tanques">Tanques</Link>. Depois de criar a lista, o
            progresso global aparece em <Link to="/gestor/checklists">Checklists</Link>. O eletricista vê a rota
            completa e regista baixa <strong>pedido a pedido</strong>.
          </p>
        </PageTitleWithHelp>
        <button
          type="button"
          onClick={() => setNovoRomaneioModalOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Nova lista de romaneio
        </button>
      </div>

      {novoRomaneioModalOpen && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gestor-romaneio-novo-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setNovoRomaneioModalOpen(false)}
          />
          <form
            onSubmit={criarRomaneio}
            className="relative z-10 max-h-[min(92vh,880px)] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="gestor-romaneio-novo-titulo" className="text-lg font-semibold text-slate-900">
                Nova lista de romaneio
              </h2>
              <button
                type="button"
                onClick={() => setNovoRomaneioModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Nome da lista *</label>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Ex.: Rota zona norte — semana 12"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Eletricista responsável *</label>
            <SearchableSelect
              value={eletricistaId}
              onChange={setEletricistaId}
              options={eletricistaOptions}
              placeholder="— Selecionar —"
              title="Eletricista responsável"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Início *</label>
              <input
                required
                type="datetime-local"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fim *</label>
              <input
                required
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800">Linhas: pedido + tanque *</span>
            <button type="button" onClick={addLinha} className="text-sm font-medium text-blue-700 hover:underline">
              + Linha
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Em cada linha escolha o pedido e o tanque físico. Aqui aparecem tanques <strong>livres</strong> (sem
            produtor e sem outro romaneio ativo). Ao <strong>criar a lista</strong>, cada tanque tem de estar também{' '}
            com estado «disponível» e <strong>sem manutenção ativa</strong> — em Tanques retire o equipamento da manutenção antes de criar a lista.
          </p>
          {linhas.map((linha, i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Linha {i + 1}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600">Pedido (produtor) *</label>
                  <SearchableSelect
                    value={linha.pedidoId}
                    onChange={(v) => setLinha(i, 'pedidoId', v)}
                    options={[
                      { value: '', label: '— Escolher —' },
                      ...pedidosParaSelect(i).map((p) => ({
                        value: p.id,
                        label: `${p.producerName} — ${p.tipoPedido} (${p.region || '—'})`,
                      })),
                    ]}
                    placeholder="— Escolher —"
                    title={`Pedido · linha ${i + 1}`}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Tanque (livre na frota) *</label>
                  <SearchableSelect
                    value={linha.tanqueId}
                    onChange={(v) => setLinha(i, 'tanqueId', v)}
                    options={[
                      { value: '', label: '— Escolher —' },
                      ...tanquesParaSelect(i).map((t) => ({
                        value: t.id,
                        label: `${t.modelo} — ${t.volumeLitros} L`,
                      })),
                    ]}
                    placeholder="— Escolher —"
                    title={`Tanque · linha ${i + 1}`}
                    className="mt-1"
                  />
                </div>
              </div>
              {linhas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLinha(i)}
                  className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Remover linha
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setNovoRomaneioModalOpen(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Criar lista e atribuir
          </button>
        </div>
      </form>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Listas de romaneio</h2>
        <p className="mt-1 text-sm text-slate-600">
          Abra um romaneio para ver todos os pedidos, estados e notas do eletricista em tempo real. Pode eliminar uma
          lista se já não for necessária.
        </p>
        <div className="mt-4 space-y-4">
          {romaneios.map((r) => {
            const { total, feitos, concluidosInstalacao } = romaneioProgress(r.itens)
            const nomeEl = eletricistaNome[r.eletricistaId] || '—'
            return (
              <div
                key={r.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{r.titulo || 'Romaneio'}</p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Eletricista:</span> {nomeEl}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.dataInicio?.toDate
                      ? format(r.dataInicio.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : ''}{' '}
                    →{' '}
                    {r.dataFim?.toDate
                      ? format(r.dataFim.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : ''}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-bold tabular-nums">
                      {feitos}/{total}
                    </span>{' '}
                    com baixa · {concluidosInstalacao} inst. concluída(s) ·{' '}
                    {ROMANEIO_STATUS_LABELS[r.status] || r.status}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    to={`/gestor/romaneio/${r.id}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Abrir
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === r.id}
                    onClick={() => eliminarRomaneio(r)}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {deletingId === r.id ? 'A eliminar…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
