import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useLeafletReady } from '../hooks/useLeafletReady'

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export default function MapReadOnly({ lat, lng, heightClass = 'h-56', scrollWheelZoom = false }) {
  const leafletReady = useLeafletReady()
  const [mapInstanceKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon
  }, [])

  if (lat == null || lng == null) {
    return (
      <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Sem coordenadas registadas.
      </p>
    )
  }

  if (!leafletReady) {
    return (
      <div
        className={`w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100 ${heightClass}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={`relative isolate z-0 w-full overflow-hidden rounded-lg border border-slate-200 ${heightClass}`}
    >
      <MapContainer
        key={mapInstanceKey}
        center={[lat, lng]}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom={scrollWheelZoom}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={defaultIcon} />
      </MapContainer>
    </div>
  )
}
