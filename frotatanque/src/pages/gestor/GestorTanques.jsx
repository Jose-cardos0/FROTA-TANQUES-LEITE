import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { toast } from 'react-toastify'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import SearchableSelect from '../../components/SearchableSelect'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import {
  appendManualVinculoHistorico,
  appendTanqueHistorico,
  TANQUE_HIST_TIPO,
} from '../../services/tanqueLifecycle'

const HIST_TIPO_UI = {
  [TANQUE_HIST_TIPO.VINCULO_ROMANEIO]: 'Romaneio — entrada na rota',
  [TANQUE_HIST_TIPO.ENTREGA_ELETRICISTA]: 'Eletricista — baixa / entrega',
  [TANQUE_HIST_TIPO.DESVINCULO_ITEM_ROMANEIO]: 'Desvinculação — removido da lista',
  [TANQUE_HIST_TIPO.DESVINCULO_ROMANEIO_APAGADO]: 'Desvinculação — romaneio eliminado',
  [TANQUE_HIST_TIPO.DESVINCULO_PEDIDO_APAGADO]: 'Desvinculação — pedido eliminado',
  [TANQUE_HIST_TIPO.VINCULO_MANUAL_GESTOR]: 'Vinculação manual (gestor)',
  [TANQUE_HIST_TIPO.DESVINCULO_MANUAL_GESTOR]: 'Desvinculação manual (gestor)',
  [TANQUE_HIST_TIPO.MANUTENCAO_ENTRADA]: 'Manutenção — entrada',
  [TANQUE_HIST_TIPO.MANUTENCAO_SAIDA]: 'Manutenção — saída',
  eletricista_baixa: 'Eletricista — registo anterior',
  manual_gestor: 'Nota manual (gestor)',
}

export default function GestorTanques() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState('em_uso')
  const PAGE_SIZE = 15
  const [page, setPage] = useState(1)
  const [cadastroModalOpen, setCadastroModalOpen] = useState(false)
  const [tanques, setTanques] = useState([])
  const [romaneios, setRomaneios] = useState([])
  const [produtores, setProdutores] = useState([])
  const [modelo, setModelo] = useState('')
  const [volumeLitros, setVolumeLitros] = useState('')
  const [historicoOpcional, setHistoricoOpcional] = useState('')
  const [tipoTransacao, setTipoTransacao] = useState('')
  const [selectedTank, setSelectedTank] = useState(null)
  const [histEntries, setHistEntries] = useState([])
  const [novaEntrada, setNovaEntrada] = useState('')
  const [editingTank, setEditingTank] = useState(null)
  const [editModelo, setEditModelo] = useState('')
  const [editVolume, setEditVolume] = useState('')
  const [editHistorico, setEditHistorico] = useState('')
  const [editTipoTransacao, setEditTipoTransacao] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [manutModal, setManutModal] = useState(null)
  const [manutMotivo, setManutMotivo] = useState('')
  const [manutNotaSaida, setManutNotaSaida] = useState('')
  const [savingManut, setSavingManut] = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'romaneios'), (s) =>
      setRomaneios(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setProdutores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  const romaneioTituloPorId = useMemo(() => {
    const m = {}
    for (const r of romaneios) {
      m[r.id] = r.titulo?.trim() || r.id.slice(0, 8) + '…'
    }
    return m
  }, [romaneios])

  useEffect(() => {
    const tid = searchParams.get('tanque')
    const tabParam = searchParams.get('tab')
    if (
      tabParam === 'em_uso' ||
      tabParam === 'em_romaneio' ||
      tabParam === 'disponivel' ||
      tabParam === 'manutencao' ||
      tabParam === 'inutilizado'
    ) {
      setTab(tabParam)
    }
    if (!tid || tanques.length === 0) return
    const t = tanques.find((x) => x.id === tid)
    if (t) {
      setSelectedTank(t)
      if (!tabParam) {
        if (t.inutilizado) setTab('inutilizado')
        else if (t.status === 'manutencao') setTab('manutencao')
        else if (t.vinculoRomaneioId) setTab('em_romaneio')
        else if (t.producerId) setTab('em_uso')
        else setTab('disponivel')
      }
    }
  }, [searchParams, tanques])

  const filtrados = useMemo(() => {
    const ativo = (t) => !t.inutilizado && t.status !== 'manutencao'
    if (tab === 'em_uso') {
      return tanques.filter(
        (t) => t.producerId && !t.vinculoRomaneioId && ativo(t),
      )
    }
    if (tab === 'em_romaneio') {
      return tanques.filter((t) => t.vinculoRomaneioId && ativo(t))
    }
    if (tab === 'disponivel') {
      return tanques.filter((t) => !t.producerId && !t.vinculoRomaneioId && ativo(t))
    }
    if (tab === 'manutencao') {
      return tanques.filter((t) => t.status === 'manutencao' && !t.inutilizado)
    }
    if (tab === 'inutilizado') {
      return tanques.filter((t) => t.inutilizado)
    }
    return tanques
  }, [tanques, tab])

  const totalPagesTanques = useMemo(() => {
    return Math.max(1, Math.ceil((filtrados?.length || 0) / PAGE_SIZE))
  }, [filtrados?.length])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    if (page > totalPagesTanques) setPage(totalPagesTanques)
  }, [page, totalPagesTanques])

  const filtradosPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filtrados.slice(start, end)
  }, [filtrados, page])

  const producerOptions = useMemo(
    () => [
      { value: '', label: '— Desvinculado —' },
      ...produtores.map((p) => ({ value: p.id, label: String(p.name || p.id) })),
    ],
    [produtores],
  )

  useEffect(() => {
    if (!selectedTank?.id) {
      setHistEntries([])
      return undefined
    }
    return onSnapshot(collection(db, 'tanques', selectedTank.id, 'historico'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0)
        const db_ = b.createdAt?.toDate?.() || new Date(0)
        return db_ - da
      })
      setHistEntries(list)
    })
  }, [selectedTank?.id])

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await addDoc(collection(db, 'tanques'), {
        modelo: modelo.trim(),
        volumeLitros: Number(volumeLitros) || 0,
        producerId: null,
        pedidoOrigemId: null,
        inutilizado: false,
        status: 'disponivel',
        tipoTransacao: tipoTransacao || null,
        historicoOpcional: historicoOpcional.trim() || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setModelo('')
      setVolumeLitros('')
      setTipoTransacao('')
      setHistoricoOpcional('')
      setCadastroModalOpen(false)
      toast.success('Tanque criado.')
    } catch {
      toast.error('Erro ao criar tanque.')
    }
  }

  async function vincular(t, producerId) {
    if (t.status === 'manutencao') {
      toast.error('Tanque em manutenção — conclua a manutenção antes de vincular a um produtor.')
      return
    }
    const prevId = t.producerId || null
    const nextId = producerId || null
    if (prevId === nextId) return
    const nomeAntes = prevId ? produtores.find((p) => p.id === prevId)?.name || prevId : ''
    const nomeDepois = nextId ? produtores.find((p) => p.id === nextId)?.name || nextId : ''
    try {
      if (prevId && !nextId) {
        await appendManualVinculoHistorico(t.id, {
          texto: `Desvinculado do produtor «${nomeAntes}» (ação manual do gestor).`,
          tipo: TANQUE_HIST_TIPO.DESVINCULO_MANUAL_GESTOR,
          producerNameAntes: nomeAntes,
          producerNameDepois: null,
        })
      } else if (!prevId && nextId) {
        await appendManualVinculoHistorico(t.id, {
          texto: `Vinculado ao produtor «${nomeDepois}» (ação manual do gestor).`,
          tipo: TANQUE_HIST_TIPO.VINCULO_MANUAL_GESTOR,
          producerNameAntes: null,
          producerNameDepois: nomeDepois,
        })
      } else {
        await appendManualVinculoHistorico(t.id, {
          texto: `Alteração de produtor: «${nomeAntes}» → «${nomeDepois}» (gestor).`,
          tipo: TANQUE_HIST_TIPO.VINCULO_MANUAL_GESTOR,
          producerNameAntes: nomeAntes,
          producerNameDepois: nomeDepois,
        })
      }
      await updateDoc(doc(db, 'tanques', t.id), {
        producerId: nextId || null,
        status: nextId ? 'em_uso' : 'disponivel',
        vinculadoAoProdutorEm: nextId ? serverTimestamp() : null,
        vinculoRomaneioId: null,
        pedidoOrigemId: null,
        updatedAt: serverTimestamp(),
      })
      toast.success('Vínculo atualizado.')
    } catch {
      toast.error('Erro.')
    }
  }

  async function setInutilizado(t, flag) {
    try {
      await updateDoc(doc(db, 'tanques', t.id), {
        inutilizado: flag,
        status: flag
          ? 'inutilizado'
          : t.status === 'manutencao'
            ? 'manutencao'
            : t.producerId
              ? 'em_uso'
              : 'disponivel',
        updatedAt: serverTimestamp(),
      })
      toast.success(flag ? 'Marcado como inutilizado.' : 'Tanque reativado.')
    } catch {
      toast.error('Erro.')
    }
  }

  function abrirManutencao(t) {
    setManutMotivo('')
    setManutModal({ type: 'entrada', tank: t })
  }

  async function confirmarEntradaManutencao(e) {
    e.preventDefault()
    const t = manutModal?.tank
    if (!t || savingManut) return
    const motivo = manutMotivo.trim()
    if (!motivo) {
      toast.error('Indique o motivo da manutenção.')
      return
    }
    setSavingManut(true)
    try {
      const nomeAntes = t.producerId
        ? produtores.find((p) => p.id === t.producerId)?.name || t.producerId
        : ''
      if (t.producerId) {
        await appendManualVinculoHistorico(t.id, {
          texto: `Desvinculado do produtor «${nomeAntes}» (entrada em manutenção).`,
          tipo: TANQUE_HIST_TIPO.DESVINCULO_MANUAL_GESTOR,
          producerNameAntes: nomeAntes,
          producerNameDepois: null,
        })
      }
      await appendTanqueHistorico(t.id, {
        texto: `Entrada em manutenção.\nMotivo: ${motivo}`,
        tipo: TANQUE_HIST_TIPO.MANUTENCAO_ENTRADA,
        motivoManutencao: motivo,
      })
      await updateDoc(doc(db, 'tanques', t.id), {
        status: 'manutencao',
        producerId: null,
        vinculoRomaneioId: null,
        pedidoOrigemId: null,
        vinculadoAoProdutorEm: null,
        manutencaoMotivo: motivo,
        manutencaoEntradaEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Tanque enviado para manutenção.')
      setManutModal(null)
      setManutMotivo('')
      setTab('manutencao')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível registar a manutenção.')
    } finally {
      setSavingManut(false)
    }
  }

  function abrirSaidaManutencao(t) {
    setManutNotaSaida('')
    setManutModal({ type: 'saida', tank: t })
  }

  async function confirmarSaidaManutencao(e) {
    e.preventDefault()
    const t = manutModal?.tank
    if (!t || savingManut) return
    setSavingManut(true)
    try {
      const nota = manutNotaSaida.trim()
      const motivo = (t.manutencaoMotivo || '').trim()
      const entradaTexto = t.manutencaoEntradaEm?.toDate
        ? format(t.manutencaoEntradaEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        : '—'
      await appendTanqueHistorico(t.id, {
        texto: [
          'Saída de manutenção — tanque disponível novamente na frota.',
          motivo && `Motivo registado à entrada: ${motivo}`,
          `Entrada em manutenção: ${entradaTexto}`,
          nota && `Notas à saída: ${nota}`,
        ]
          .filter(Boolean)
          .join('\n'),
        tipo: TANQUE_HIST_TIPO.MANUTENCAO_SAIDA,
        motivoManutencao: motivo || null,
        notaSaidaManutencao: nota || null,
      })
      await updateDoc(doc(db, 'tanques', t.id), {
        status: 'disponivel',
        manutencaoMotivo: null,
        manutencaoEntradaEm: null,
        manutencaoSaidaEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Manutenção concluída. Tanque volta para «Disponíveis».')
      setManutModal(null)
      setManutNotaSaida('')
      setTab('disponivel')
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível concluir a manutenção.')
    } finally {
      setSavingManut(false)
    }
  }

  async function adicionarHistoricoManual() {
    if (!selectedTank || !novaEntrada.trim()) return
    try {
      await addDoc(collection(db, 'tanques', selectedTank.id, 'historico'), {
        texto: novaEntrada.trim(),
        tipo: 'manual_gestor',
        createdAt: serverTimestamp(),
      })
      setNovaEntrada('')
      toast.success('Entrada adicionada ao histórico.')
    } catch {
      toast.error('Erro ao guardar histórico.')
    }
  }

  function abrirEdicao(t) {
    setEditingTank(t)
    setEditModelo(t.modelo || '')
    setEditVolume(String(t.volumeLitros ?? ''))
    setEditHistorico(t.historicoOpcional || '')
    setEditTipoTransacao(t.tipoTransacao || '')
  }

  function fecharEdicao() {
    setEditingTank(null)
    setEditModelo('')
    setEditVolume('')
    setEditHistorico('')
    setEditTipoTransacao('')
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    if (!editingTank) return
    setSavingEdit(true)
    try {
      const modeloTrim = editModelo.trim()
      await updateDoc(doc(db, 'tanques', editingTank.id), {
        modelo: modeloTrim,
        volumeLitros: Number(editVolume) || 0,
        tipoTransacao: editTipoTransacao || null,
        historicoOpcional: editHistorico.trim() || '',
        updatedAt: serverTimestamp(),
      })
      toast.success('Cadastro do tanque atualizado.')
      if (selectedTank?.id === editingTank.id) {
        setSelectedTank((prev) =>
          prev
            ? {
                ...prev,
                modelo: modeloTrim,
                volumeLitros: Number(editVolume) || 0,
                tipoTransacao: editTipoTransacao || null,
                historicoOpcional: editHistorico.trim() || '',
              }
            : null,
        )
      }
      fecharEdicao()
    } catch {
      toast.error('Erro ao guardar alterações.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function eliminarTanque(t) {
    const msg =
      t.producerId != null
        ? `Este tanque está vinculado a um produtor. Eliminar "${t.modelo}" remove o registo e todo o histórico. Pedidos ou romaneios que o referenciem podem ficar inconsistentes. Continuar?`
        : `Eliminar permanentemente o tanque "${t.modelo}" (${t.volumeLitros} L) e todo o histórico associado?`
    if (!window.confirm(msg)) return
    try {
      const histSnap = await getDocs(collection(db, 'tanques', t.id, 'historico'))
      let batch = writeBatch(db)
      let n = 0
      for (const d of histSnap.docs) {
        batch.delete(d.ref)
        n++
        if (n === 500) {
          await batch.commit()
          batch = writeBatch(db)
          n = 0
        }
      }
      if (n > 0) await batch.commit()
      await deleteDoc(doc(db, 'tanques', t.id))
      if (selectedTank?.id === t.id) setSelectedTank(null)
      toast.success('Tanque eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar o tanque.'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitleWithHelp title="Tanques" tooltipId="help-gestor-tanques">
          <p>
            A <strong>frota física</strong>: cada registo é um equipamento (modelo, volume). Pode enviar um tanque para{' '}
            <strong>manutenção</strong> (com motivo e registo no histórico); enquanto estiver em manutenção não entra em
            romaneios.             Vincule a um <Link to="/gestor/produtores">produtor</Link> quando o equipamento estiver na
            propriedade. Tanques em <strong>lista de romaneio</strong> aparecem na aba «Em romaneio» (com atalho para o
            romaneio). O <strong>histórico</strong> junta manutenções, romaneios e baixas do eletricista.
          </p>
        </PageTitleWithHelp>
        <button
          type="button"
          onClick={() => setCadastroModalOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Cadastrar tanque
        </button>
      </div>

      {cadastroModalOpen && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gestor-tanque-cadastro-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setCadastroModalOpen(false)}
          />
          <form
            onSubmit={handleCreate}
            className="relative z-10 grid w-full max-w-lg gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="gestor-tanque-cadastro-titulo" className="text-lg font-semibold text-slate-900">
                Cadastrar tanque
              </h2>
              <button
                type="button"
                onClick={() => setCadastroModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div>
              <label className="text-sm font-medium">Modelo *</label>
              <input
                required
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Volume (L) *</label>
              <input
                required
                type="number"
                min={0}
                value={volumeLitros}
                onChange={(e) => setVolumeLitros(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo (opcional)</label>
              <select
                value={tipoTransacao}
                onChange={(e) => setTipoTransacao(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Selecione —</option>
                <option value="doacao">Doação</option>
                <option value="aquisicao">Aquisição</option>
              </select>
            </div>
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
                Histórico opcional (notas)
              </summary>
              <textarea
                value={historicoOpcional}
                onChange={(e) => setHistoricoOpcional(e.target.value)}
                rows={3}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </details>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCadastroModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Guardar tanque
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'em_uso', label: 'Em uso (vinculados)' },
          { id: 'em_romaneio', label: 'Em romaneio' },
          { id: 'disponivel', label: 'Disponíveis (sem produtor)' },
          { id: 'manutencao', label: 'Manutenção' },
          { id: 'inutilizado', label: 'Inutilizados' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setTab(b.id)
              if (selectedTank?.id) {
                setSearchParams({ tanque: selectedTank.id, tab: b.id })
              }
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === b.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2">Modelo</th>
              <th className="px-3 py-2">Volume</th>
              {tab === 'manutencao' ? (
                <>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Entrada</th>
                </>
              ) : (
                <>
                  {tab === 'em_romaneio' && <th className="px-3 py-2">Romaneio</th>}
                  <th className="px-3 py-2">Produtor</th>
                </>
              )}
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradosPaginados.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{t.modelo}</td>
                <td className="px-3 py-2">{t.volumeLitros}</td>
                {tab === 'manutencao' ? (
                  <>
                    <td className="max-w-[14rem] px-3 py-2 text-slate-700" title={t.manutencaoMotivo || ''}>
                      {t.manutencaoMotivo || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {t.manutencaoEntradaEm?.toDate
                        ? format(t.manutencaoEntradaEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                        : '—'}
                    </td>
                  </>
                ) : (
                  <>
                    {tab === 'em_romaneio' && t.vinculoRomaneioId && (
                      <td className="px-3 py-2">
                        <Link
                          to={`/gestor/romaneio/${t.vinculoRomaneioId}`}
                          className="font-medium text-blue-700 underline hover:text-blue-900"
                        >
                          {romaneioTituloPorId[t.vinculoRomaneioId] || '—'}
                        </Link>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <SearchableSelect
                        value={t.producerId || ''}
                        onChange={(v) => vincular(t, v || null)}
                        options={producerOptions}
                        placeholder="Produtor"
                        title="Produtor"
                        className="max-w-[min(260px,100%)]"
                        buttonClassName="min-h-[36px] py-1.5 text-xs"
                      />
                    </td>
                  </>
                )}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {tab !== 'manutencao' && (
                      <button
                        type="button"
                        onClick={() => abrirManutencao(t)}
                        className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900 hover:bg-orange-200"
                      >
                        Manutenção
                      </button>
                    )}
                    {tab === 'manutencao' && (
                      <button
                        type="button"
                        onClick={() => abrirSaidaManutencao(t)}
                        className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 hover:bg-emerald-200"
                      >
                        Concluir manutenção
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInutilizado(t, !t.inutilizado)}
                      className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                    >
                      Inutilizado
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(t)}
                      className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 hover:bg-indigo-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTank(t)
                        setSearchParams({ tanque: t.id, tab })
                      }}
                      className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900"
                    >
                      Histórico
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarTanque(t)}
                      className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-sm text-slate-600">
          Página <span className="font-medium text-slate-800">{page}</span> de{' '}
          <span className="font-medium text-slate-800">{totalPagesTanques}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPagesTanques}
            onClick={() => setPage((p) => Math.min(totalPagesTanques, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>

      {editingTank && (
        <form
          onSubmit={salvarEdicao}
          className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Editar cadastro do tanque</h2>
              <p className="text-sm text-slate-600">Modelo, volume e notas gerais do cadastro.</p>
            </div>
            <button
              type="button"
              onClick={fecharEdicao}
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Modelo *</label>
              <input
                required
                value={editModelo}
                onChange={(e) => setEditModelo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Volume (L) *</label>
              <input
                required
                type="number"
                min={0}
                value={editVolume}
                onChange={(e) => setEditVolume(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Tipo (opcional)</label>
              <select
                value={editTipoTransacao}
                onChange={(e) => setEditTipoTransacao(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Selecione —</option>
                <option value="doacao">Doação</option>
                <option value="aquisicao">Aquisição</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <details
                className="rounded-lg border border-slate-200 bg-white p-3"
                open={!!editHistorico}
              >
                <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
                  Histórico opcional (notas)
                </summary>
                <textarea
                  value={editHistorico}
                  onChange={(e) => setEditHistorico(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </details>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingEdit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingEdit ? 'A guardar…' : 'Guardar alterações'}
            </button>
            <button
              type="button"
              onClick={fecharEdicao}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-white"
            >
              Fechar
            </button>
          </div>
        </form>
      )}

      {manutModal?.type === 'entrada' && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={confirmarEntradaManutencao}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Enviar para manutenção</h3>
            <p className="mt-1 text-sm text-slate-600">
              {manutModal.tank.modelo} · {manutModal.tank.volumeLitros} L
            </p>
            {manutModal.tank.producerId ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                O vínculo ao produtor será removido e registado no histórico.
              </p>
            ) : null}
            <label className="mt-4 block text-sm font-medium text-slate-700">Motivo da manutenção *</label>
            <textarea
              required
              value={manutMotivo}
              onChange={(e) => setManutMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: Vedantes, painel elétrico, lavagem interna…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setManutModal(null)
                  setManutMotivo('')
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingManut}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {savingManut ? 'A guardar…' : 'Confirmar entrada'}
              </button>
            </div>
          </form>
        </div>
      )}

      {manutModal?.type === 'saida' && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={confirmarSaidaManutencao}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Concluir manutenção</h3>
            <p className="mt-1 text-sm text-slate-600">
              {manutModal.tank.modelo} — o tanque volta para <strong>Disponíveis</strong>.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">Notas à saída (opcional)</label>
            <textarea
              value={manutNotaSaida}
              onChange={(e) => setManutNotaSaida(e.target.value)}
              rows={2}
              placeholder="Ex.: Reposto, testado em bancada…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setManutModal(null)
                  setManutNotaSaida('')
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingManut}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingManut ? 'A guardar…' : 'Disponibilizar tanque'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTank && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-blue-900">Histórico — {selectedTank.modelo}</h3>
              <p className="text-sm text-blue-800">Entradas manuais e automáticas (eletricista).</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTank(null)
                setSearchParams({})
              }}
              className="text-sm text-blue-800 underline"
            >
              Fechar
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={novaEntrada}
              onChange={(e) => setNovaEntrada(e.target.value)}
              placeholder="Ex.: Em 10/01/2026 o tanque voltou para o laticínio…"
              className="flex-1 rounded-lg border border-blue-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={adicionarHistoricoManual}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            >
              Adicionar linha
            </button>
          </div>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
            {histEntries.map((h) => (
              <li key={h.id} className="rounded border border-blue-100 bg-white p-3">
                <span className="text-xs text-slate-500">
                  {h.createdAt?.toDate
                    ? format(h.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                    : ''}
                  {h.tipo ? ` · ${HIST_TIPO_UI[h.tipo] || h.tipo}` : ''}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{h.texto}</p>
                {(h.compradorNome || h.eletricistaNome || h.motivoSolicitacao || h.tipoPedidoLabel) && (
                  <dl className="mt-2 grid gap-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                    {h.compradorNome ? (
                      <>
                        <dt className="font-medium text-slate-500">Comprador</dt>
                        <dd>{h.compradorNome}</dd>
                      </>
                    ) : null}
                    {h.eletricistaNome ? (
                      <>
                        <dt className="font-medium text-slate-500">Eletricista</dt>
                        <dd>{h.eletricistaNome}</dd>
                      </>
                    ) : null}
                    {h.tipoPedidoLabel ? (
                      <>
                        <dt className="font-medium text-slate-500">Tipo de serviço</dt>
                        <dd>{h.tipoPedidoLabel}</dd>
                      </>
                    ) : null}
                    {h.motivoSolicitacao ? (
                      <>
                        <dt className="font-medium text-slate-500">Solicitação (comprador)</dt>
                        <dd className="whitespace-pre-wrap">{h.motivoSolicitacao}</dd>
                      </>
                    ) : null}
                  </dl>
                )}
                {h.fotos?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {h.fotos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">
                        foto
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
