import { useEffect, useCallback, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { MapPin } from 'lucide-react'
import { toast } from 'react-toastify'
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

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapViewSync({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true })
    }
  }, [lat, lng, map])
  return null
}

function MapPickerInner({
  lat,
  lng,
  onChange,
  heightClass,
  mapInstanceKey,
  geoOnMount,
  onChangeRef,
  onGeoAppliedRef,
}) {
  const position = lat != null && lng != null ? [lat, lng] : [-14.235, -51.9253]

  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon
  }, [])

  useEffect(() => {
    if (!geoOnMount) return
    if (lat != null && lng != null) return
    if (!navigator.geolocation) return

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        const la = pos.coords.latitude
        const ln = pos.coords.longitude
        onChangeRef.current(la, ln)
        onGeoAppliedRef.current?.(la, ln)
      },
      (err) => {
        if (cancelled) return
        if (err.code === 1) {
          toast.info(
            'Para marcar automaticamente o mapa, permita o acesso à localização quando o navegador pedir. Também pode clicar no mapa.',
          )
        }
      },
      GEO_OPTIONS,
    )
    return () => {
      cancelled = true
    }
  }, [geoOnMount, lat, lng])

  return (
    <div
      className={`relative isolate z-0 w-full overflow-hidden rounded-lg border border-slate-200 ${heightClass}`}
    >
      <MapContainer
        key={mapInstanceKey}
        center={position}
        zoom={lat != null && lng != null ? 14 : 5}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync lat={lat} lng={lng} />
        <ClickHandler onPick={onChange} />
        {lat != null && lng != null && (
          <Marker position={[lat, lng]} icon={defaultIcon} />
        )}
      </MapContainer>
    </div>
  )
}

/**
 * Mapa para marcar latitude/longitude.
 * Com `geoOnMount` (predefinição: true), pede a localização atual ao abrir se ainda não houver coordenadas.
 * `onGeolocationApplied` é chamado quando as coordenadas vêm da geolocalização (botão ou pedido inicial ao abrir).
 */
export default function MapPicker({
  lat,
  lng,
  onChange,
  onGeolocationApplied,
  heightClass = 'h-52 sm:h-64 md:h-72',
  geoOnMount = true,
}) {
  const leafletReady = useLeafletReady()
  const [mapInstanceKey] = useState(() => crypto.randomUUID())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onGeoAppliedRef = useRef(onGeolocationApplied)
  onGeoAppliedRef.current = onGeolocationApplied

  const pedirLocalizacao = useCallback(() => {
    if (!navigator.geolocation) {
      toast.info('O seu navegador não suporta geolocalização. Clique no mapa para marcar o ponto.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude
        const ln = pos.coords.longitude
        onChangeRef.current(la, ln)
        onGeoAppliedRef.current?.(la, ln)
        toast.success('Localização atual aplicada no mapa.')
      },
      (err) => {
        if (err.code === 1) {
          toast.info(
            'Permissão de localização negada. Pode ativar nas definições do navegador ou clicar no mapa para marcar o sítio.',
          )
        } else if (err.code === 2) {
          toast.info('Não foi possível obter a posição. Tente clicar no mapa.')
        } else if (err.code === 3) {
          toast.info('Tempo esgotado ao obter a localização. Tente de novo ou marque no mapa.')
        } else {
          toast.info('Não foi possível usar a localização atual. Clique no mapa para marcar.')
        }
      },
      GEO_OPTIONS,
    )
  }, [])

  return (
    <div className="space-y-2">
      {!leafletReady ? (
        <div
          className={`w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100 ${heightClass}`}
          aria-hidden
        />
      ) : (
        <MapPickerInner
          lat={lat}
          lng={lng}
          onChange={onChange}
          heightClass={heightClass}
          mapInstanceKey={mapInstanceKey}
          geoOnMount={geoOnMount}
          onChangeRef={onChangeRef}
          onGeoAppliedRef={onGeoAppliedRef}
        />
      )}
      <button
        type="button"
        onClick={pedirLocalizacao}
        className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-800 hover:bg-blue-100 sm:w-auto"
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        Usar a minha localização
      </button>
    </div>
  )
}
