'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

const start: L.LatLngExpression = [9.582578, 76.97107]
const pallikunnu: L.LatLngExpression = [9.59831, 76.96825]
const finish: L.LatLngExpression = [9.586024, 76.983061]
const route: L.LatLngExpression[] = [
  start,
  [9.5843, 76.9701],
  [9.5882, 76.9691],
  [9.5927, 76.9686],
  [9.5961, 76.9683],
  pallikunnu,
  [9.5987, 76.9701],
  [9.5972, 76.9726],
  [9.5945, 76.9753],
  [9.5918, 76.9781],
  [9.5893, 76.9804],
  finish,
]
const refreshmentStops: { point: L.LatLngExpression; distance: number }[] = [
  { point: [9.5946, 76.9685], distance: 2 },
  { point: [9.5901, 76.9795], distance: 4 },
]
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
    const map = L.map(elementRef.current, { center: start, zoom: 14, scrollWheelZoom: false, zoomControl: false })
    mapRef.current = map
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    tileLayerRef.current = L.tileLayer(streetTiles, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map)
    L.polyline(route, { color: '#ec3047', weight: 8, opacity: 0.96 }).addTo(map)
    L.polyline(route, { color: '#ffffff', weight: 2, dashArray: '7 10', opacity: 0.95 }).addTo(map)
    L.circle(start, { radius: 65, color: '#11174f', fillColor: '#11174f', fillOpacity: 1 }).addTo(map).bindTooltip('START · Kuttikkanam', { permanent: true, direction: 'top', offset: [0, -12] })
    L.circle(pallikunnu, { radius: 50, color: '#ec3047', fillColor: '#ffffff', fillOpacity: 1 }).addTo(map).bindTooltip('VIA · Pallikunnu', { permanent: true, direction: 'top', offset: [0, -12] })
    L.circle(finish, { radius: 65, color: '#9bf03c', fillColor: '#9bf03c', fillOpacity: 1 }).addTo(map).bindTooltip('FINISH · MBCCET', { permanent: true, direction: 'top', offset: [0, -12] })
    refreshmentStops.forEach(({ point, distance }) => {
      L.circle(point, { radius: 35, color: '#11174f', fillColor: '#9bf03c', fillOpacity: 1 }).addTo(map).bindTooltip(`${distance} KM · WATER`)
    })
    map.fitBounds(L.latLngBounds(route), { padding: [28, 28] })
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
      <div ref={elementRef} className="leaflet-map" role="img" aria-label="Indicative 5 kilometre route from Kuttikkanam Town via Pallikunnu to MBCCET, with water stops at two and four kilometres" />
      <button className="map-zoom" type="button" onClick={toggleZoom} aria-pressed={zoom}>
        {zoom ? 'Scroll map to zoom: on' : 'Click to enable map zoom'}
      </button>
      <div className="map-stops"><span>START</span><i /><span>2 KM · WATER</span><i /><span>4 KM · WATER</span><i /><span>FINISH</span></div>
    </div>
  )
}
