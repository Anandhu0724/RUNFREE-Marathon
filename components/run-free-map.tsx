'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

const start: L.LatLngExpression = [9.575, 76.973]
const finish: L.LatLngExpression = [9.592, 76.991]
const route: L.LatLngExpression[] = [start, [9.579, 76.978], [9.584, 76.982], [9.588, 76.987], finish]
const mapCenter: L.LatLngExpression = [9.584, 76.982]
const streetTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const satelliteTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export default function RunFreeMap() {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const [satellite, setSatellite] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!elementRef.current) return
    const map = L.map(elementRef.current, { center: mapCenter, zoom: 14, scrollWheelZoom: false, zoomControl: false })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    tileLayerRef.current = L.tileLayer(streetTiles, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map)
    L.polyline(route, { color: '#1479ff', weight: 7, opacity: 0.95 }).addTo(map)
    L.polyline(route, { color: '#ffffff', weight: 2, dashArray: '7 10', opacity: 0.95 }).addTo(map)
    L.circle(start, { radius: 65, color: '#11174f', fillColor: '#11174f', fillOpacity: 1 }).addTo(map).bindTooltip('START · Kuttikkanam', { permanent: true, direction: 'top', offset: [0, -12] })
    L.circle(finish, { radius: 65, color: '#9bf03c', fillColor: '#9bf03c', fillOpacity: 1 }).addTo(map).bindTooltip('FINISH · MBCCET', { permanent: true, direction: 'top', offset: [0, -12] })
    route.slice(1, 3).forEach((point, index) => {
      L.circle(point, { radius: 35, color: '#11174f', fillColor: '#9bf03c', fillOpacity: 1 }).addTo(map).bindTooltip(`Refreshment point ${index + 1}`)
    })
    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tileLayerRef.current?.remove()
    const layer = satellite
      ? L.tileLayer(satelliteTiles, { attribution: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics' })
      : L.tileLayer(streetTiles, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
    tileLayerRef.current = layer.addTo(map)
  }, [satellite])

  function toggleZoom() {
    const map = mapRef.current
    if (!map) return
    if (zoom) map.scrollWheelZoom.disable()
    else map.scrollWheelZoom.enable()
    setZoom(!zoom)
  }

  return (
    <div className="map-shell">
      <div className="map-tools">
        <span className="map-label"><span className="live-dot" /> ROUTE OVERVIEW</span>
        <button type="button" className="map-toggle" onClick={() => setSatellite(!satellite)} aria-pressed={satellite}>
          {satellite ? 'Street map' : 'Satellite'}
        </button>
      </div>
      <div ref={elementRef} className="leaflet-map" role="img" aria-label="Indicative 5 kilometre route from Kuttikkanam Town to MBCCET, with refreshment stops at two and four kilometres" />
      <button className="map-zoom" type="button" onClick={toggleZoom} aria-pressed={zoom}>
        {zoom ? 'Scroll map to zoom: on' : 'Click to enable map zoom'}
      </button>
      <div className="map-stops"><span>START</span><i /><span>2 KM · WATER</span><i /><span>4 KM · WATER</span><i /><span>FINISH</span></div>
    </div>
  )
}
