import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import MapPicker from '../../components/MapPicker'
import SearchableSelect from '../../components/SearchableSelect'
import PageTitleWithHelp from '../../components/PageTitleWithHelp'
import { toast } from 'react-toastify'
import { PEDIDO_TIPO, PEDIDO_STATUS } from '../../constants/roles'
import { reverseGeocodeLatLng } from '../../utils/reverseGeocode'
import { ensureProducerForTypedInstalacao } from '../../utils/ensureProducerForInstalacao'
import { enrichProducerCadastroFromComprador } from '../../utils/enrichProducerCadastro'
import {
  PRODUTOR_CADASTRO_DOC_KEYS,
  PRODUTOR_CADASTRO_DOC_LABELS,
  PRODUTOR_CADASTRO_ACCEPT,
  emptyCadastroDocsState,
  isAllowedProducerCadastroFile,
} from '../../constants/producerCadastroDocs'
import { storageErrorMessagePT } from '../../utils/firebaseStorageErrors'

const TIPO_PEDIDO_OPTIONS = [
  { value: PEDIDO_TIPO.INSTALACAO, label: 'Instalação' },
  { value: PEDIDO_TIPO.TROCA, label: 'Troca' },
  { value: PEDIDO_TIPO.REMOCAO, label: 'Remoção' },
  { value: PEDIDO_TIPO.MANUTENCAO, label: 'Manutenção' },
]

export default function NovoPedido() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [formStarted, setFormStarted] = useState(false)
  const [tipoModal, setTipoModal] = useState(PEDIDO_TIPO.INSTALACAO)
  const [producerName, setProducerName] = useState('')
  const [region, setRegion] = useState('')
  const [volumeLitros, setVolumeLitros] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [tipoPedido, setTipoPedido] = useState(PEDIDO_TIPO.INSTALACAO)
  const [notes, setNotes] = useState('')
  const [producerCadastroId, setProducerCadastroId] = useState('')
  const [produtores, setProdutores] = useState([])
  const [saving, setSaving] = useState(false)
  const [reverseGeoBusy, setReverseGeoBusy] = useState(false)
  const [bankDetailsText, setBankDetailsText] = useState('')
  const [producerPhoneCadastro, setProducerPhoneCadastro] = useState('')
  const [cadastroFiles, setCadastroFiles] = useState(() => emptyCadastroDocsState())

  const isInstalacao = tipoPedido === PEDIDO_TIPO.INSTALACAO
  const isRemocao = tipoPedido === PEDIDO_TIPO.REMOCAO
  const isTrocaOuManutencao =
    tipoPedido === PEDIDO_TIPO.TROCA || tipoPedido === PEDIDO_TIPO.MANUTENCAO
  const nomeRegiaoDoCadastro = !!producerCadastroId
  const prevProducerCadastroRef = useRef(producerCadastroId)

  useEffect(() => {
    return onSnapshot(collection(db, 'produtores'), (s) =>
      setProdutores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [])

  useEffect(() => {
    if (isTrocaOuManutencao && !producerCadastroId) {
      setProducerName('')
      setRegion('')
    }
  }, [isTrocaOuManutencao, producerCadastroId])

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
    if (prev && !producerCadastroId && (isInstalacao || isRemocao)) {
      setProducerName('')
      setRegion('')
    }
  }, [producerCadastroId, produtores, isInstalacao, isRemocao])

  useEffect(() => {
    if (isInstalacao && !producerCadastroId) return
    setCadastroFiles(emptyCadastroDocsState())
    setBankDetailsText('')
    setProducerPhoneCadastro('')
  }, [isInstalacao, producerCadastroId])

  function addCadastroFiles(categoriaKey, fileList) {
    const incoming = Array.from(fileList || [])
    if (incoming.length === 0) return
    const rejected = []
    const ok = []
    for (const f of incoming) {
      if (isAllowedProducerCadastroFile(f)) ok.push(f)
      else rejected.push(f.name)
    }
    if (rejected.length) {
      toast.error(`Formato não aceite (use PNG, JPG ou PDF): ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`)
    }
    if (!ok.length) return
    setCadastroFiles((prev) => ({
      ...prev,
      [categoriaKey]: [...(prev[categoriaKey] || []), ...ok],
    }))
  }

  function removeCadastroFile(categoriaKey, index) {
    setCadastroFiles((prev) => {
      const list = [...(prev[categoriaKey] || [])]
      list.splice(index, 1)
      return { ...prev, [categoriaKey]: list }
    })
  }

  const producerOptionsInstalacao = [
    { value: '', label: '— Novo nome: cria produtor no cadastro ao enviar —' },
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

  const producerOptionsRemocao = [
    { value: '', label: '— Escrever nome à mão (sem escolher no cadastro) —' },
    ...produtores.map((p) => ({
      value: p.id,
      label: `${p.name || p.id}${p.region ? ` · ${p.region}` : ''}`,
    })),
  ]

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

  function continuarDepoisDoTipo() {
    setTipoPedido(tipoModal)
    setFormStarted(true)
  }

  function voltarAoTipo() {
    setTipoModal(tipoPedido)
    setFormStarted(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!profile?.id) return
    if (!address.trim()) {
      toast.error('Indique o endereço.')
      return
    }
    if (isTrocaOuManutencao) {
      if (!producerCadastroId) {
        toast.error('Selecione o produtor no cadastro Natville.')
        return
      }
    } else if (isInstalacao && !producerCadastroId && !producerName.trim()) {
      toast.error('Indique o nome do produtor ou selecione um produtor no cadastro.')
      return
    } else if (isRemocao && !producerCadastroId) {
      if (!producerName.trim() || !region.trim()) {
        toast.error('Selecione um produtor no cadastro ou indique nome e região do produtor.')
        return
      }
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
    setSaving(true)
    try {
      let finalProducerId = producerCadastroId || null
      if (isInstalacao && !producerCadastroId) {
        finalProducerId = await ensureProducerForTypedInstalacao({
          produtores,
          producerName: producerName.trim(),
          region: region.trim(),
          address: address.trim(),
          createdByUserId: profile.id,
          source: 'comprador_instalacao',
        })
        await enrichProducerCadastroFromComprador(finalProducerId, {
          phone: producerPhoneCadastro,
          bankDetailsText,
          filesByCategory: cadastroFiles,
        })
      } else if (isRemocao && !producerCadastroId) {
        finalProducerId = await ensureProducerForTypedInstalacao({
          produtores,
          producerName: producerName.trim(),
          region: region.trim(),
          address: address.trim(),
          createdByUserId: profile.id,
          source: 'comprador_remocao',
        })
      }

      await addDoc(collection(db, 'pedidos'), {
        compradorId: profile.id,
        producerName: producerName.trim(),
        region: region.trim(),
        volumeLitros: Number(volumeLitros) || 0,
        orderDate,
        address: address.trim(),
        lat: lat ?? null,
        lng: lng ?? null,
        tipoPedido,
        notes: notes.trim() || '',
        status: PEDIDO_STATUS.ABERTO,
        tanqueId: null,
        producerId: finalProducerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editHistory: [],
        lastCompradorEditAt: null,
      })
      toast.success('Pedido criado com sucesso.')
      navigate('/comprador')
    } catch (err) {
      console.error(err)
      toast.error(storageErrorMessagePT(err) || 'Não foi possível guardar o pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative mx-auto max-w-3xl space-y-6">
      <div>
        <PageTitleWithHelp title="Novo pedido" tooltipId="help-comprador-novo-pedido">
          <p>
            <strong>Instalação</strong> costuma ser um <strong>novo produtor</strong>: pode escrever o nome e região (o
            produtor é criado automaticamente no cadastro ao enviar o pedido) ou escolher alguém já no cadastro Natville.             <strong>Troca e manutenção</strong> exigem produtor no cadastro; em <strong>remoção</strong> pode escolher no
            cadastro ou escrever nome e região (identificação no terreno). O <strong>gestor</strong> vê o pedido em aberto e
            pode montar o romaneio; o <strong>eletricista</strong> usa o mapa, o endereço e as{' '}
            <strong>notas do comprador</strong> no terreno. O endereço é obrigatório; ao usar a localização atual,
            tentamos preencher o endereço automaticamente (OpenStreetMap).
          </p>
        </PageTitleWithHelp>
        <p className="mt-2 text-slate-600">
          Primeiro escolha o <strong>tipo de pedido</strong>; depois preencha os restantes campos.
        </p>
      </div>

      {!formStarted && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="novo-pedido-tipo-titulo"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="novo-pedido-tipo-titulo" className="text-lg font-semibold text-slate-900">
              Tipo de pedido
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Defina se é uma <strong>nova instalação</strong> ou um serviço num produtor já acompanhado (troca, remoção
              ou manutenção). O formulário adapta-se ao que escolher.
            </p>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Tipo *</label>
              <SearchableSelect
                value={tipoModal}
                onChange={setTipoModal}
                options={TIPO_PEDIDO_OPTIONS}
                placeholder="Tipo de pedido"
                title="Tipo de pedido"
                className="mt-1"
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={continuarDepoisDoTipo}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => navigate('/comprador')}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {formStarted && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-700">
              <span className="font-medium">Tipo:</span>{' '}
              {TIPO_PEDIDO_OPTIONS.find((o) => o.value === tipoPedido)?.label || tipoPedido}
            </p>
            <button
              type="button"
              onClick={voltarAoTipo}
              className="text-sm font-medium text-blue-800 underline"
            >
              Alterar tipo de pedido
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Produtor no cadastro Natville
                {isInstalacao || isRemocao ? ' (opcional)' : ' *'}
              </label>
              <SearchableSelect
                value={producerCadastroId}
                onChange={setProducerCadastroId}
                options={
                  isInstalacao
                    ? producerOptionsInstalacao
                    : isRemocao
                      ? producerOptionsRemocao
                      : producerOptionsCadastroObrigatorio
                }
                placeholder={
                  isInstalacao
                    ? '— Opcional —'
                    : isRemocao
                      ? '— Opcional: escolher no cadastro —'
                      : '— Escolher —'
                }
                title="Produtor no cadastro Natville"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                {isInstalacao
                  ? 'Se não escolher ninguém aqui, o nome e região que escrever abaixo passam a existir no cadastro de produtores ao criar o pedido (reutilizamos se já existir o mesmo nome e região).'
                  : isRemocao
                    ? 'Pode escolher alguém do cadastro ou escrever nome e região abaixo (ex.: produtor ainda não registado).'
                    : 'Obrigatório para troca e manutenção — nome e região vêm do cadastro.'}
              </p>
            </div>

            {isInstalacao || isRemocao ? (
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
                  title={
                    nomeRegiaoDoCadastro
                      ? 'Preenchido automaticamente a partir do cadastro Natville.'
                      : undefined
                  }
                />
                {nomeRegiaoDoCadastro ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Definido pelo cadastro — altere trocando a seleção acima.
                  </p>
                ) : isRemocao ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Obrigatório se não escolher produtor no cadastro — use o nome tal como deve aparecer no pedido de
                    remoção.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Obrigatório se não escolher produtor no cadastro — será registado no cadastro ao enviar (ou ligado a um
                    já existente com o mesmo nome e região).
                  </p>
                )}
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">Região do produtor *</label>
              <input
                required
                readOnly={nomeRegiaoDoCadastro || isTrocaOuManutencao}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 ${
                  nomeRegiaoDoCadastro || isTrocaOuManutencao
                    ? 'cursor-not-allowed bg-slate-100 text-slate-800'
                    : ''
                }`}
                title={
                  nomeRegiaoDoCadastro || isTrocaOuManutencao
                    ? 'Preenchido automaticamente a partir do cadastro Natville.'
                    : undefined
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Volume do tanque (litros) *</label>
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
              <label className="text-sm font-medium text-slate-700">Localização no mapa (opcional)</label>
              <p className="mb-2 text-xs text-slate-500">
                Ao abrir, pedimos a sua localização para aproximar o mapa. Pode ajustar clicando no mapa ou em &quot;Usar
                a minha localização&quot; — quando usar a localização, tentamos preencher o endereço acima.
              </p>
              <MapPicker lat={lat} lng={lng} onChange={onMapChange} onGeolocationApplied={onGeolocationApplied} />
              <p className="mt-2 text-xs text-slate-600">
                {lat != null && lng != null ? `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}` : 'Sem coordenadas'}
              </p>
            </div>
            {isInstalacao && !producerCadastroId ? (
              <div className="sm:col-span-2 space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-sm font-semibold text-slate-900">Documentos opcionais (novo produtor)</p>
                <p className="text-xs text-slate-600">
                  Pode anexar quantos ficheiros quiser (PNG, JPG ou PDF) por categoria. Os dados ficam no cadastro do
                  produtor para o gestor consultar.
                </p>
                <div>
                  <label className="text-sm font-medium text-slate-700">Dados bancários (texto livre)</label>
                  <textarea
                    value={bankDetailsText}
                    onChange={(e) => setBankDetailsText(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Banco, agência, conta, titular, PIX…"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Telefone do produtor</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={producerPhoneCadastro}
                    onChange={(e) => setProducerPhoneCadastro(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Ex.: 79 9 9999-9999"
                  />
                </div>
                {PRODUTOR_CADASTRO_DOC_KEYS.map((key) => (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                    <label className="text-sm font-medium text-slate-800">
                      {PRODUTOR_CADASTRO_DOC_LABELS[key]}
                    </label>
                    <input
                      type="file"
                      multiple
                      accept={PRODUTOR_CADASTRO_ACCEPT}
                      className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white"
                      onChange={(e) => {
                        addCadastroFiles(key, e.target.files)
                        e.target.value = ''
                      }}
                    />
                    {(cadastroFiles[key] || []).length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {cadastroFiles[key].map((f, idx) => (
                          <li key={`${key}-${idx}-${f.name}`} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate" title={f.name}>
                              {f.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCadastroFile(key, idx)}
                              className="shrink-0 text-red-700 underline"
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Notas do comprador</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Instruções para o eletricista, acesso à propriedade, referências…"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'A enviar…' : 'Enviar pedido'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/comprador')}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
