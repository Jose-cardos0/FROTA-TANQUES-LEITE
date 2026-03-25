import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useLeafletReady } from '../hooks/useLeafletReady'
import { PEDIDO_STATUS } from '../constants/roles'

const BR_CENTER = [-14.235, -51.9253]

function makeDotIcon(color) {
  return L.divIcon({
    className: 'gestor-pedidos-dot-marker',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.45)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

const iconGreen = makeDotIcon('#16a34a')
const iconRed = makeDotIcon('#dc2626')

function hasCoords(p) {
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) {
      map.setView(BR_CENTER, 4)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36] })
  }, [map, points])
  return null
}

/**
 * Mapa (OpenStreetMap + Leaflet) com pedidos que tenham lat/lng: verde = em romaneio, vermelho = aberto.
 * Sem chave de API.
 */
export default function GestorPedidosMap({ pedidos }) {
  const leafletReady = useLeafletReady()
  const [mapInstanceKey] = useState(() => crypto.randomUUID())

  const { emRomaneio, emAberto, allPoints } = useMemo(() => {
    const green = []
    const red = []
    for (const p of pedidos) {
      if (!hasCoords(p)) continue
      const lat = Number(p.lat)
      const lng = Number(p.lng)
      const label = (p.producerName || 'Pedido').trim() || p.id.slice(0, 8)
      if (p.status === PEDIDO_STATUS.EM_ROMANEIO) {
        green.push({ id: p.id, lat, lng, label })
      } else if (p.status === PEDIDO_STATUS.ABERTO) {
        red.push({ id: p.id, lat, lng, label })
      }
    }
    return { emRomaneio: green, emAberto: red, allPoints: [...green, ...red] }
  }, [pedidos])

  if (!leafletReady) {
    return <div className="h-64 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100" aria-hidden />
  }

  if (allPoints.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Nenhum pedido «em romaneio» ou «aberto» com coordenadas. Os compradores podem marcar a localização ao criar o
        pedido.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-64 flex-col">
      <div className="relative isolate z-0 h-64 w-full overflow-hidden rounded-lg border border-slate-200 md:h-72">
        <MapContainer
          key={mapInstanceKey}
          center={BR_CENTER}
          zoom={4}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={allPoints} />
          {emRomaneio.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={iconGreen} title={`${m.label} — em romaneio`} />
          ))}
          {emAberto.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={iconRed} title={`${m.label} — aberto`} />
          ))}
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600 align-middle" /> Em romaneio ·{' '}
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" /> Aberto 
      </p>
    </div>
  )
}
