import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import MapPicker from '../../components/MapPicker'
import SearchableSelect from '../../components/SearchableSelect'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { toast } from 'react-toastify'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PEDIDO_STATUS, PEDIDO_TIPO } from '../../constants/roles'
import { reverseGeocodeLatLng } from '../../utils/reverseGeocode'
import { ensureProducerForTypedInstalacao } from '../../utils/ensureProducerForInstalacao'

const TIPO_PEDIDO_OPTIONS = [
  { value: PEDIDO_TIPO.INSTALACAO, label: 'Instalação' },
  { value: PEDIDO_TIPO.TROCA, label: 'Troca' },
  { value: PEDIDO_TIPO.REMOCAO, label: 'Remoção' },
  { value: PEDIDO_TIPO.MANUTENCAO, label: 'Manutenção' },
]

export default function EditarPedido() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [pedido, setPedido] = useState(null)
  const [producerName, setProducerName] = useState('')
  const [region, setRegion] = useState('')
  const [volumeLitros, setVolumeLitros] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [tipoPedido, setTipoPedido] = useState(PEDIDO_TIPO.INSTALACAO)
  const [notes, setNotes] = useState('')
  const [producerCadastroId, setProducerCadastroId] = useState('')
  const [produtores, setProdutores] = useState([])
  const [saving, setSaving] = useState(false)
  const [reverseGeoBusy, setReverseGeoBusy] = useState(false)
  const prevProducerCadastroRef = useRef('')

  const isInstalacao = tipoPedido === PEDIDO_TIPO.INSTALACAO
  const nomeRegiaoDoCadastro = !!producerCadastroId

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setProdutores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    if (!isInstalacao && !producerCadastroId) {
      setProducerName('')
      setRegion('')
    }
  }, [isInstalacao, producerCadastroId])

  useEffect(() => {
    const prev = prevProducerCadastroRef.current
    prevProducerCadastroRef.current = producerCadastroId
    if (producerCadastroId) {
      const p = produtores.find((x) => x.id === producerCadastroId)
      if (p) {
        setProducerName(String(p.name || '').trim())
        setRegion(String(p.region || '').trim())
      }
      return
    }
    if (prev && !producerCadastroId && isInstalacao) {
      setProducerName('')
      setRegion('')
    }
  }, [producerCadastroId, produtores, isInstalacao])

  const producerOptionsInstalacao = [
    { value: '', label: '— Novo nome: cria produtor no cadastro ao guardar —' },
    ...produtores.map((p) => ({
      value: p.id,
      label: `${p.name || p.id}${p.region ? ` · ${p.region}` : ''}`,
    })),
  ]

  const producerOptionsCadastroObrigatorio = [
    { value: '', label: '— Escolher produtor no cadastro Natville —' },
    ...produtores.map((p) => ({
      value: p.id,
      label: `${p.name || p.id}${p.region ? ` · ${p.region}` : ''}`,
    })),
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      const snap = await getDoc(doc(db, 'pedidos', id))
      if (cancelled) return
      if (!snap.exists()) {
        setPedido(null)
        setLoading(false)
        return
      }
      const p = { id: snap.id, ...snap.data() }
      if (p.compradorId !== profile?.id) {
        setPedido(null)
        setLoading(false)
        return
      }
      setPedido(p)
      setProducerName(p.producerName || '')
      setRegion(p.region || '')
      setVolumeLitros(String(p.volumeLitros ?? ''))
      setOrderDate(p.orderDate || '')
      setAddress(p.address || '')
      setLat(p.lat ?? null)
      setLng(p.lng ?? null)
      setTipoPedido(p.tipoPedido || PEDIDO_TIPO.INSTALACAO)
      setNotes(p.notes || '')
      const pid = p.producerId || ''
      setProducerCadastroId(pid)
      prevProducerCadastroRef.current = pid
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, profile?.id])

  function onMapChange(la, ln) {
    setLat(la)
    setLng(ln)
  }

  const onGeolocationApplied = useCallback(async (la, ln) => {
    setReverseGeoBusy(true)
    try {
      const addr = await reverseGeocodeLatLng(la, ln)
      if (addr) setAddress(addr)
    } finally {
      setReverseGeoBusy(false)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pedido || !profile?.id) return
    const isRecusadoAgora = pedido.status === PEDIDO_STATUS.CANCELADO
    if (!address.trim()) {
      toast.error('Indique o endereço.')
      return
    }
    if (!isInstalacao) {
      if (!producerCadastroId) {
        toast.error('Selecione o produtor no cadastro Natville.')
        return
      }
    } else if (!producerCadastroId && !producerName.trim()) {
      toast.error('Indique o nome do produtor ou selecione um produtor no cadastro.')
      return
    }
    if (!region.trim()) {
      toast.error('Indique a região do produtor.')
      return
    }
    if (producerCadastroId) {
      const p = produtores.find((x) => x.id === producerCadastroId)
      if (!p) {
        toast.error('O produtor selecionado já não está no cadastro. Escolha outro ou limpe a ligação.')
        return
      }
    }
    const snapshotBefore = {
      producerName: pedido.producerName,
      region: pedido.region,
      volumeLitros: pedido.volumeLitros,
      orderDate: pedido.orderDate,
      address: pedido.address,
      lat: pedido.lat,
      lng: pedido.lng,
      tipoPedido: pedido.tipoPedido,
      notes: pedido.notes,
      producerId: pedido.producerId || null,
    }
    setSaving(true)
    try {
      let resolvedProducerId = producerCadastroId || ''
      if (isInstalacao && !producerCadastroId) {
        resolvedProducerId = await ensureProducerForTypedInstalacao({
          produtores,
          producerName: producerName.trim(),
          region: region.trim(),
          address: address.trim(),
          createdByUserId: profile.id,
        })
      }

      const newData = {
        producerName: producerName.trim(),
        region: region.trim(),
        volumeLitros: Number(volumeLitros) || 0,
        orderDate,
        address: address.trim(),
        lat: lat ?? null,
        lng: lng ?? null,
        tipoPedido,
        notes: notes.trim() || '',
        producerId: resolvedProducerId || null,
      }

      const editHistory = [...(pedido.editHistory || [])]
      editHistory.push({
        at: new Date().toISOString(),
        userId: profile.id,
        summary: isRecusadoAgora
          ? 'Reenvio após recusa pelo gestor'
          : 'Edição pelo comprador de leite',
        antes: snapshotBefore,
        depois: newData,
      })
      await updateDoc(doc(db, 'pedidos', pedido.id), {
        ...newData,
        status: isRecusadoAgora ? PEDIDO_STATUS.ABERTO : pedido.status,
        refusedReason: isRecusadoAgora ? null : pedido.refusedReason ?? null,
        refusedAt: isRecusadoAgora ? null : pedido.refusedAt ?? null,
        editHistory,
        updatedAt: serverTimestamp(),
        lastCompradorEditAt: serverTimestamp(),
      })
      toast.success(
        isRecusadoAgora
          ? 'Pedido reenviado ao gestor.'
          : 'Pedido atualizado. O gestor pode ver o histórico de alterações.',
      )
      navigate('/comprador')
    } catch {
      toast.error('Erro ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-600">A carregar…</p>
  }
  if (!pedido) {
    return <p className="text-red-600">Pedido não encontrado ou sem permissão.</p>
  }
  const isRecusado = pedido.status === PEDIDO_STATUS.CANCELADO

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <PageTitleWithHelp title="Editar pedido" tooltipId="help-comprador-editar-pedido">
          <p>
            Altere dados, mapa ou notas enquanto o pedido ainda estiver editável. <strong>Instalação</strong> permite
            nome livre ou cadastro; <strong>troca, remoção e manutenção</strong> exigem produtor no cadastro Natville. O
            endereço é obrigatório. Cada gravação fica no <strong>histórico</strong> (visível para si e para o gestor).
          </p>
        </PageTitleWithHelp>
      </div>

      {isRecusado && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Pedido recusado pelo gestor</p>
          <p className="mt-1 text-sm text-red-800 whitespace-pre-wrap">
            Motivo: {pedido.refusedReason?.trim() ? pedido.refusedReason : '—'}
          </p>
          <p className="mt-2 text-xs text-red-700">
            Pode editar este pedido e gravar novamente para reenviar ao gestor.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Tipo de pedido *</label>
            <SearchableSelect
              value={tipoPedido}
              onChange={setTipoPedido}
              options={TIPO_PEDIDO_OPTIONS}
              placeholder="Tipo"
              title="Tipo de pedido"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Produtor no cadastro Natville{isInstalacao ? ' (recomendado)' : ' *'}
            </label>
            <SearchableSelect
              value={producerCadastroId}
              onChange={setProducerCadastroId}
              options={isInstalacao ? producerOptionsInstalacao : producerOptionsCadastroObrigatorio}
              placeholder={isInstalacao ? '— Opcional —' : '— Escolher —'}
              title="Produtor no cadastro Natville"
              className="mt-1"
            />
          </div>
          {isInstalacao ? (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Nome do produtor *</label>
              <input
                required={!producerCadastroId}
                readOnly={nomeRegiaoDoCadastro}
                value={producerName}
                onChange={(e) => setProducerName(e.target.value)}
                className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 ${
                  nomeRegiaoDoCadastro ? 'cursor-not-allowed bg-slate-100 text-slate-800' : ''
                }`}
              />
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium text-slate-700">Região *</label>
            <input
              required
              readOnly={nomeRegiaoDoCadastro || !isInstalacao}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 ${
                nomeRegiaoDoCadastro || !isInstalacao ? 'cursor-not-allowed bg-slate-100 text-slate-800' : ''
              }`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Volume (L) *</label>
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
            <label className="text-sm font-medium text-slate-700">Data do pedido *</label>
            <input
              required
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Endereço *</label>
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {reverseGeoBusy ? (
              <p className="mt-1 text-xs text-slate-500">A obter morada a partir do mapa…</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Mapa</label>
            <MapPicker lat={lat} lng={lng} onChange={onMapChange} onGeolocationApplied={onGeolocationApplied} />
            <p className="mt-2 text-xs text-slate-600">
              {lat != null && lng != null ? `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}` : 'Sem coordenadas'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Notas do comprador</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'A guardar…' : isRecusado ? 'Reenviar ao gestor' : 'Guardar alterações'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/comprador')}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Histórico de edições</h2>
        <p className="text-sm text-slate-600">
          Útil para auditoria: o gestor vê o que mudou após o pedido ter sido criado ou após atualizações no campo.
        </p>
        <ul className="mt-4 space-y-4">
          {(pedido.editHistory || []).length === 0 && (
            <li className="text-sm text-slate-500">Ainda não houve edições após a criação.</li>
          )}
          {[...(pedido.editHistory || [])].reverse().map((h, i) => (
            <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-800">
                {h.at
                  ? format(new Date(h.at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : '—'}{' '}
                — {h.summary || 'Edição'}
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-xs text-slate-600">
                {JSON.stringify({ antes: h.antes, depois: h.depois }, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
