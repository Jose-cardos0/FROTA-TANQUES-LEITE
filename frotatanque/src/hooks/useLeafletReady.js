import { useState, useEffect } from 'react'

/**
 * Leaflet precisa de DOM real; no React 18+ Strict Mode o mapa não pode inicializar
 * antes do cliente estar pronto (evita appendChild undefined / contentor reutilizado).
 */
export function useLeafletReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])
  return ready
}
