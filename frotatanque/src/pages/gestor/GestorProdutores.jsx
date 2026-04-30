import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { firestoreErrorMessagePT } from '../../utils/firebaseFirestoreErrors'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { Plus, FileText, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  PRODUTOR_CADASTRO_DOC_KEYS,
  PRODUTOR_CADASTRO_DOC_KEYS_TERRENO,
  PRODUTOR_CADASTRO_DOC_LABELS,
} from '../../constants/producerCadastroDocs'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Há ficheiros anexados em cadastroDocs (Firestore / Storage). */
function produtorTemAnexosCadastro(produtor) {
  const cd = produtor?.cadastroDocs
  if (!cd || typeof cd !== 'object') return false
  for (const key of PRODUTOR_CADASTRO_DOC_KEYS) {
    const list = cd[key]
    if (Array.isArray(list) && list.some((item) => item?.url)) return true
  }
  const legado = cd.acessibilidade
  if (Array.isArray(legado) && legado.some((item) => item?.url)) return true
  return false
}

export default function GestorProdutores() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editBankDetailsText, setEditBankDetailsText] = useState('')
  const [editAcessibilidadeText, setEditAcessibilidadeText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [tanques, setTanques] = useState([])
  const [cadastroModalOpen, setCadastroModalOpen] = useState(false)
  const [docsModalProducer, setDocsModalProducer] = useState(null)

  const PAGE_SIZE = 30
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroRegiao, setFiltroRegiao] = useState('')
  const [filtroTanque, setFiltroTanque] = useState('')
  const [filtroTelefone, setFiltroTelefone] = useState('')
  const [filtroEndereco, setFiltroEndereco] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'tanques'), (s) =>
      setTanques(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  const tanquesPorProdutor = useMemo(() => {
    const m = {}
    for (const t of tanques) {
      if (!t.producerId || t.inutilizado) continue
      if (!m[t.producerId]) m[t.producerId] = []
      m[t.producerId].push(t)
    }
    return m
  }, [tanques])

  const rowsFiltrados = useMemo(() => {
    const n = filtroNome.trim().toLowerCase()
    const reg = filtroRegiao.trim().toLowerCase()
    const tq = filtroTanque.trim().toLowerCase()
    const tel = filtroTelefone.trim().toLowerCase()
    const end = filtroEndereco.trim().toLowerCase()

    const list = rows.filter((r) => {
      if (n && !String(r.name || '').toLowerCase().includes(n)) return false
      if (reg && !String(r.region || '').toLowerCase().includes(reg)) return false
      if (tel && !String(r.phone || '').toLowerCase().includes(tel)) return false
      if (end && !String(r.address || '').toLowerCase().includes(end)) return false
      if (tq) {
        const vinc = tanquesPorProdutor[r.id] || []
        const ok = vinc.some((t) => {
          const modelo = String(t.modelo || '').toLowerCase()
          const vol = String(t.volumeLitros ?? '')
          const id = String(t.id || '').toLowerCase()
          return modelo.includes(tq) || vol.includes(tq) || id.includes(tq)
        })
        if (!ok) return false
      }
      return true
    })
    list.sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }),
    )
    return list
  }, [
    rows,
    tanquesPorProdutor,
    filtroNome,
    filtroRegiao,
    filtroTanque,
    filtroTelefone,
    filtroEndereco,
  ])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rowsFiltrados.length / PAGE_SIZE)),
    [rowsFiltrados.length],
  )

  useEffect(() => {
    setPage(1)
  }, [filtroNome, filtroRegiao, filtroTanque, filtroTelefone, filtroEndereco])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const rowsPagina = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rowsFiltrados.slice(start, start + PAGE_SIZE)
  }, [rowsFiltrados, page])

  function limparFiltros() {
    setFiltroNome('')
    setFiltroRegiao('')
    setFiltroTanque('')
    setFiltroTelefone('')
    setFiltroEndereco('')
  }

  function formatarTanquesParaExport(vinc) {
    if (!vinc?.length) return ''
    return vinc
      .map((t) => {
        const partes = [`${t.modelo || '—'} · ${t.volumeLitros ?? '—'} L`, t.id ? `ID: ${t.id}` : null]
        if (t.vinculadoAoProdutorEm?.toDate) {
          partes.push(
            `Vínculo: ${format(t.vinculadoAoProdutorEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
          )
        }
        return partes.filter(Boolean).join(' | ')
      })
      .join('\n')
  }

  function exportarProdutoresExcel() {
    const ordenados = [...rows].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }),
    )
    const dados = ordenados.map((r) => {
      const vinc = tanquesPorProdutor[r.id] || []
      return {
        ID: r.id,
        Nome: r.name ?? '',
        Região: r.region ?? '',
        Telefone: r.phone ?? '',
        Endereço: r.address ?? '',
        Tanques: formatarTanquesParaExport(vinc),
        'Dados bancários': r.bankDetailsText ?? '',
        Acessibilidade: r.acessibilidadeText ?? '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produtores')
    const stamp = format(new Date(), 'yyyy-MM-dd_HHmm')
    XLSX.writeFile(wb, `produtores_${stamp}.xlsx`)
    toast.success('Ficheiro Excel gerado.')
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!profile?.id) return
    try {
      await addDoc(collection(db, 'produtores'), {
        name: name.trim(),
        region: region.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        bankDetailsText: null,
        createdAt: serverTimestamp(),
        createdBy: profile.id,
      })
      setName('')
      setRegion('')
      setPhone('')
      setAddress('')
      setCadastroModalOpen(false)
      toast.success('Produtor registado.')
    } catch {
      toast.error('Erro ao guardar.')
    }
  }

  function abrirEdicao(r) {
    setEditing(r)
    setEditName(r.name || '')
    setEditRegion(r.region || '')
    setEditPhone(r.phone || '')
    setEditAddress(r.address || '')
    setEditBankDetailsText(r.bankDetailsText || '')
    setEditAcessibilidadeText(r.acessibilidadeText || '')
  }

  function fecharEdicao() {
    setEditing(null)
    setEditName('')
    setEditRegion('')
    setEditPhone('')
    setEditAddress('')
    setEditBankDetailsText('')
    setEditAcessibilidadeText('')
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    if (!editing) return
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, 'produtores', editing.id), {
        name: editName.trim(),
        region: editRegion.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        bankDetailsText: editBankDetailsText.trim() || null,
        acessibilidadeText: editAcessibilidadeText.trim() || null,
        updatedAt: serverTimestamp(),
      })
      toast.success('Produtor atualizado.')
      fecharEdicao()
    } catch {
      toast.error('Erro ao guardar alterações.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function eliminarProdutor(r) {
    try {
      const vinc = query(collection(db, 'tanques'), where('producerId', '==', r.id))
      const snap = await getDocs(vinc)
      if (!snap.empty) {
        toast.error(
          'Existem tanques vinculados a este produtor. Desvincule-os em Tanques antes de eliminar.',
        )
        return
      }
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível verificar vínculos.'))
      return
    }
    if (!window.confirm(`Eliminar permanentemente o produtor "${r.name}"?`)) return
    try {
      await deleteDoc(doc(db, 'produtores', r.id))
      if (editing?.id === r.id) fecharEdicao()
      toast.success('Produtor eliminado.')
    } catch (err) {
      console.error(err)
      toast.error(firestoreErrorMessagePT(err, 'Não foi possível eliminar.'))
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitleWithHelp title="Produtores" tooltipId="help-gestor-produtores">
          <p>
            Produtores rurais onde os tanques são instalados ou mantidos. Cada produtor pode ficar{' '}
            <strong>vinculado a um tanque</strong> na secção <Link to="/gestor/tanques">Tanques</Link> — isso alinha
            pedidos de instalação/troca com a frota física. Ao montar um <Link to="/gestor/romaneio">romaneio</Link>, o
            tanque entra em <strong>em uso</strong> no cadastro e o nome do produtor passa a ligar à{' '}
            <strong>ficha e histórico</strong> desse equipamento. Só pode eliminar um produtor se não houver tanques
            associados.
          </p>
        </PageTitleWithHelp>
        <button
          type="button"
          onClick={() => setCadastroModalOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          Cadastrar produtor
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Filtrar lista</p>
        <p className="mt-1 text-xs text-slate-500">
          Campos opcionais — combina vários critérios. Em tanque pode pesquisar modelo, litros ou referência.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-slate-600">Nome</label>
            <input
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contém…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Região</label>
            <input
              value={filtroRegiao}
              onChange={(e) => setFiltroRegiao(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contém…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Tanque</label>
            <input
              value={filtroTanque}
              onChange={(e) => setFiltroTanque(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Modelo, L ou ID…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Telefone</label>
            <input
              value={filtroTelefone}
              onChange={(e) => setFiltroTelefone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contém…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Endereço</label>
            <input
              value={filtroEndereco}
              onChange={(e) => setFiltroEndereco(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contém…"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={limparFiltros}
            className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={exportarProdutoresExcel}
            disabled={rows.length === 0}
            title="Exporta todos os produtores da base (ignora filtros da lista)."
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Exportar Excel (todos)
          </button>
          <span className="text-xs text-slate-500">
            {rowsFiltrados.length} produtor(es) {rowsFiltrados.length !== rows.length ? `(de ${rows.length})` : ''}
          </span>
        </div>
      </div>

      {docsModalProducer && (
        <div
          className="fixed inset-0 z-[9700] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gestor-produtor-docs-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setDocsModalProducer(null)}
          />
          <div className="relative z-10 max-h-[min(90vh,760px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="gestor-produtor-docs-titulo" className="text-lg font-semibold text-slate-900">
                Cadastro e documentos — {docsModalProducer.name}
              </h2>
              <button
                type="button"
                onClick={() => setDocsModalProducer(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Telefone</p>
                <p className="mt-1">{docsModalProducer.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Dados bancários (texto)</p>
                <p className="mt-1 whitespace-pre-wrap">{docsModalProducer.bankDetailsText || '—'}</p>
              </div>
              {(() => {
                const bankFiles = Array.isArray(docsModalProducer.cadastroDocs?.dadosBancarios)
                  ? docsModalProducer.cadastroDocs.dadosBancarios
                  : []
                return (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold text-slate-800">
                      {PRODUTOR_CADASTRO_DOC_LABELS.dadosBancarios}
                    </p>
                    {bankFiles.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">Sem anexos.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {bankFiles.map((docu, idx) => (
                          <li key={`dadosBancarios-${idx}-${docu.url}`}>
                            <a
                              href={docu.url}
                              target="_blank"
                              rel="noreferrer"
                              download={docu.fileName || 'documento'}
                              className="inline-flex items-center gap-2 font-medium text-blue-700 underline hover:text-blue-900"
                            >
                              <FileText className="h-4 w-4 shrink-0" aria-hidden />
                              {docu.fileName || 'Abrir ficheiro'}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })()}
              {PRODUTOR_CADASTRO_DOC_KEYS_TERRENO.map((key) => {
                const list = Array.isArray(docsModalProducer.cadastroDocs?.[key])
                  ? docsModalProducer.cadastroDocs[key]
                  : []
                return (
                  <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold text-slate-800">{PRODUTOR_CADASTRO_DOC_LABELS[key]}</p>
                    {list.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">Sem ficheiros.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {list.map((docu, idx) => (
                          <li key={`${key}-${idx}-${docu.url}`}>
                            <a
                              href={docu.url}
                              target="_blank"
                              rel="noreferrer"
                              download={docu.fileName || 'documento'}
                              className="inline-flex items-center gap-2 font-medium text-blue-700 underline hover:text-blue-900"
                            >
                              <FileText className="h-4 w-4 shrink-0" aria-hidden />
                              {docu.fileName || 'Abrir ficheiro'}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Acessibilidade (texto)</p>
                <p className="mt-1 whitespace-pre-wrap">{docsModalProducer.acessibilidadeText || '—'}</p>
              </div>
              {Array.isArray(docsModalProducer.cadastroDocs?.acessibilidade) &&
              docsModalProducer.cadastroDocs.acessibilidade.length > 0 ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    Acessibilidade (ficheiros antigos antes da alteração para texto)
                  </p>
                  <ul className="mt-2 space-y-2">
                    {docsModalProducer.cadastroDocs.acessibilidade.map((docu, idx) => (
                      <li key={`acess-leg-${idx}-${docu.url}`}>
                        <a
                          href={docu.url}
                          target="_blank"
                          rel="noreferrer"
                          download={docu.fileName || 'documento'}
                          className="inline-flex items-center gap-2 font-medium text-blue-700 underline hover:text-blue-900"
                        >
                          <FileText className="h-4 w-4 shrink-0" aria-hidden />
                          {docu.fileName || 'Abrir ficheiro'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {cadastroModalOpen && (
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gestor-produtor-cadastro-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar"
            onClick={() => setCadastroModalOpen(false)}
          />
          <form
            onSubmit={handleAdd}
            className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="gestor-produtor-cadastro-titulo" className="text-lg font-semibold text-slate-900">
                Novo produtor
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
              <label className="text-sm font-medium">Nome *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Região *</label>
              <input
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Endereço</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCadastroModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <form
          onSubmit={salvarEdicao}
          className="max-w-xl space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Editar produtor</h2>
            <button
              type="button"
              onClick={fecharEdicao}
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Região *</label>
            <input
              required
              value={editRegion}
              onChange={(e) => setEditRegion(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Endereço</label>
            <input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Dados bancários (texto livre)</label>
            <textarea
              value={editBankDetailsText}
              onChange={(e) => setEditBankDetailsText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Banco, agência, conta…"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Acessibilidade (texto)</label>
            <textarea
              value={editAcessibilidadeText}
              onChange={(e) => setEditAcessibilidadeText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Acesso à propriedade, obstáculos…"
            />
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Tanque na propriedade</th>
              <th className="px-4 py-2">Região</th>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Endereço</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum produtor registado.
                </td>
              </tr>
            )}
            {rows.length > 0 && rowsFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum produtor corresponde aos filtros.
                </td>
              </tr>
            )}
            {rowsPagina.map((r) => {
              const vinc = tanquesPorProdutor[r.id] || []
              const principal = vinc[0]
              const temAnexosCadastro = produtorTemAnexosCadastro(r)
              return (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {principal ? (
                    <Link
                      to={`/gestor/tanques?tanque=${principal.id}&tab=em_uso`}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="max-w-[14rem] px-4 py-2 text-sm text-slate-700">
                  {vinc.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {vinc.map((t) => (
                        <li key={t.id}>
                          <Link
                            to={`/gestor/tanques?tanque=${t.id}&tab=em_uso`}
                            className="font-medium text-blue-700 underline"
                          >
                            {t.modelo} · {t.volumeLitros} L
                          </Link>
                          {t.vinculadoAoProdutorEm?.toDate ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              Vínculo:{' '}
                              {format(t.vinculadoAoProdutorEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-2">{r.region}</td>
                <td className="px-4 py-2">{r.phone || '—'}</td>
                <td className="max-w-[200px] truncate px-4 py-2 text-slate-600" title={r.address || ''}>
                  {r.address || '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setDocsModalProducer(r)}
                      className={
                        temAnexosCadastro
                          ? 'rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-200'
                          : 'rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
                      }
                    >
                      {temAnexosCadastro ? 'Documentos' : 'Não tem documento'}
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(r)}
                      className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarProdutor(r)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rowsFiltrados.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Página <span className="font-medium text-slate-800">{page}</span> de{' '}
            <span className="font-medium text-slate-800">{totalPages}</span>
            <span className="text-slate-500"> · {PAGE_SIZE} por página</span>
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
