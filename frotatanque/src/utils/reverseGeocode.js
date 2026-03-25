/**
 * Endereço legível a partir de coordenadas (OpenStreetMap Nominatim).
 * Uso responsável: https://operations.osmfoundation.org/policies/nominatim/
 */
export async function reverseGeocodeLatLng(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(ln)}&format=json&accept-language=pt-BR,pt`
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'NatvilleFrotaTanques/1.0 (frota tanques leite)',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    const name = data.display_name
    return typeof name === 'string' && name.trim() ? name.trim() : null
  } catch {
    return null
  }
}
