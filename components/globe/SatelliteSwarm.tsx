/**
 * components/globe/SatelliteSwarm.tsx
 * Space Drishti — GPU Instanced Satellite Renderer (Final Fix)
 *
 * Fixes:
 * 1. BLACK COLOR — MeshBasicMaterial needs color=white when vertexColors=true.
 *    Also instanceColor buffer must be explicitly created before setColorAt().
 *
 * 2. ONLY PAYLOADS — normalizeCategory() now handles ALL known Space-Track
 *    object_type values: "R/B", "DEB", "TBA", "UNK", mixed case, etc.
 *    Also added console.log to verify what categories are actually coming in.
 *
 * 3. NULL CRASH — safePropagate() guards against boolean false, NaN, Infinity.
 */

'use client'

import { useRef, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import * as satellite from 'satellite.js'
import type { SatelliteSummary } from '@/lib/validators'

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371
const SCALE = 1 / EARTH_RADIUS_KM

// Dot sizes — relative to Earth radius (1.0 unit)
const CATEGORY_SIZE: Record<string, number> = {
  PAYLOAD:     0.009,
  ROCKET_BODY: 0.008,
  DEBRIS:      0.007,
  UNKNOWN:     0.007,
}

// Colors — pure hex values
const COLORS = {
  PAYLOAD:     new THREE.Color(0x00d4ff),   // cyan
  ROCKET_BODY: new THREE.Color(0xff8c00),   // amber
  DEBRIS:      new THREE.Color(0xff3333),   // red
  UNKNOWN:     new THREE.Color(0xaaaaaa),   // gray
  SELECTED:    new THREE.Color(0xffffff),   // white
}

// ─── Category normalizer ──────────────────────────────────────────────────────
// Space-Track sends many variants. Map ALL of them to our 4 categories.

function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN'
  
  const s = raw.toUpperCase().replace(/\s+/g, '_').trim()

  // Exact matches first
  if (s === 'PAYLOAD')              return 'PAYLOAD'
  if (s === 'ROCKET_BODY')          return 'ROCKET_BODY'
  if (s === 'DEBRIS')               return 'DEBRIS'

  // Space-Track raw object_type values
  if (s === 'R/B')                  return 'ROCKET_BODY'  // Rocket Body
  if (s === 'DEB')                  return 'DEBRIS'       // Debris
  if (s === 'TBA')                  return 'UNKNOWN'      // To Be Assigned
  if (s === 'UNK')                  return 'UNKNOWN'      // Unknown

  // Partial matches
  if (s.includes('ROCKET'))         return 'ROCKET_BODY'
  if (s.includes('R/B'))            return 'ROCKET_BODY'
  if (s.includes('DEB'))            return 'DEBRIS'
  if (s.includes('PAYLOAD'))        return 'PAYLOAD'

  return 'UNKNOWN'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedSat {
  index:    number
  norad_id: number
  name:     string
  category: string
  satrec:   satellite.SatRec | null
  color:    THREE.Color
  size:     number
  valid:    boolean
}

export interface HoverInfo {
  norad_id: number
  name:     string
  category: string
  x:        number
  y:        number
}

// ─── Safe propagation ─────────────────────────────────────────────────────────

function safePropagate(
  satrec: satellite.SatRec,
  date: Date
): satellite.EciVec3<number> | null {
  try {
    const result = satellite.propagate(satrec, date)
    if (!result?.position ) return null
    
    const pos = result.position as satellite.EciVec3<number>
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return null
    
    const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
    if (dist < 6200 || dist > 600000) return null  // sanity: LEO to GEO+
    
    return pos
  } catch {
    return null
  }
}

// ─── TLE parser ───────────────────────────────────────────────────────────────

function parseSatrecs(sats: SatelliteSummary[]): ParsedSat[] {
  // Debug: log unique categories coming from API
  const rawCategories = [...new Set(sats.map(s => s.category))]
  console.log('[SatelliteSwarm] Raw categories from API:', rawCategories)

  const result = sats.map((sat, index) => {
    const category = normalizeCategory(sat.category)

    const hasValidTLE =
      sat.tle_line1?.length >= 60 &&
      sat.tle_line2?.length >= 60

    if (!hasValidTLE) {
      return {
        index, norad_id: sat.norad_id, name: sat.name,
        category, satrec: null,
        color: COLORS.UNKNOWN, size: CATEGORY_SIZE.UNKNOWN, valid: false,
      }
    }

    try {
      const satrec = satellite.twoline2satrec(sat.tle_line1, sat.tle_line2)
      const valid  = satrec.error === 0

      return {
        index,
        norad_id: sat.norad_id,
        name:     sat.name,
        category,
        satrec:   valid ? satrec : null,
        color:    COLORS[category as keyof typeof COLORS] ?? COLORS.UNKNOWN,
        size:     CATEGORY_SIZE[category] ?? CATEGORY_SIZE.UNKNOWN,
        valid,
      }
    } catch {
      return {
        index, norad_id: sat.norad_id, name: sat.name,
        category, satrec: null,
        color: COLORS.UNKNOWN, size: CATEGORY_SIZE.UNKNOWN, valid: false,
      }
    }
  })

  // Debug: log normalized category counts
  const normalized: Record<string, number> = {}
  result.forEach(r => { normalized[r.category] = (normalized[r.category] || 0) + 1 })
  console.log('[SatelliteSwarm] Normalized category counts:', normalized)
  console.log(`[SatelliteSwarm] Valid TLEs: ${result.filter(r => r.valid).length} / ${result.length}`)

  return result
}

function eciToThree(x: number, y: number, z: number): [number, number, number] {
  return [x * SCALE, z * SCALE, -y * SCALE]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SatelliteSwarmProps {
  satellites: SatelliteSummary[]
  selectedId: number | null
  onSelect:   (sat: SatelliteSummary | null) => void
  onHover:    (info: HoverInfo | null) => void
}

export function SatelliteSwarm({
  satellites, selectedId, onSelect, onHover
}: SatelliteSwarmProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { gl }  = useThree()

  const parsed      = useMemo(() => parseSatrecs(satellites), [satellites])
  const validParsed = useMemo(() => parsed.filter(s => s.valid && s.satrec !== null), [parsed])
  const count       = parsed.length

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // ─── Init: create instanceColor buffer + set all colors ──────────────────
  // KEY FIX: instanceColor buffer must be manually created BEFORE setColorAt()
  // Without this, R3F doesn't allocate it and colors remain black.

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return

    // Explicitly create the instanceColor buffer attribute
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    )

    parsed.forEach((sat, i) => {
      const col = sat.norad_id === selectedId ? COLORS.SELECTED : sat.color
      mesh.setColorAt(i, col)
    })
    mesh.instanceColor.needsUpdate = true

    // Hide all invalid satellites (scale 0)
    parsed.forEach((sat, i) => {
      if (!sat.valid) {
        dummy.position.set(0, 0, 0)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, count])  // deliberately exclude selectedId — handled by next effect

  // ─── Update colors on selection change ────────────────────────────────────

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh?.instanceColor) return

    const tempColor = new THREE.Color()
    parsed.forEach((sat, i) => {
      tempColor.copy(sat.norad_id === selectedId ? COLORS.SELECTED : sat.color)
      mesh.setColorAt(i, tempColor)
    })
    mesh.instanceColor.needsUpdate = true
  }, [selectedId, parsed])

  // ─── Propagation loop ─────────────────────────────────────────────────────

  const lastPropRef = useRef(0)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const now = Date.now()
    if (now - lastPropRef.current < 2000) return  // propagate every 2s
    lastPropRef.current = now

    const date = new Date(now)

    validParsed.forEach(sat => {
      const i   = sat.index
      const pos = safePropagate(sat.satrec!, date)

      if (pos === null) {
        dummy.scale.set(0, 0, 0)
        dummy.position.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        return
      }

      const [tx, ty, tz] = eciToThree(pos.x, pos.y, pos.z)
      const s = sat.norad_id === selectedId ? sat.size * 2.5 : sat.size

      dummy.position.set(tx, ty, tz)
      dummy.scale.set(s, s, s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  })

  // ─── Click ────────────────────────────────────────────────────────────────

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) { onSelect(null); return }
    const hit = parsed[e.instanceId]
    if (hit) onSelect(satellites[hit.index] ?? null)
  }, [parsed, satellites, onSelect])

  // ─── Hover ────────────────────────────────────────────────────────────────

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) return
    const hit = parsed[e.instanceId]
    if (!hit) return
    const rect = gl.domElement.getBoundingClientRect()
    onHover({
      norad_id: hit.norad_id,
      name:     hit.name,
      category: hit.category,
      x:        e.nativeEvent.clientX - rect.left,
      y:        e.nativeEvent.clientY - rect.top,
    })
    gl.domElement.style.cursor = 'pointer'
  }, [parsed, gl, onHover])

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(null)
    gl.domElement.style.cursor = 'default'
  }, [gl, onHover])

  // ─── Geometry + Material ──────────────────────────────────────────────────
  // FIX: color must be WHITE (0xffffff) when vertexColors=true
  // If color is anything else, it multiplies with vertex color → wrong tint

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color:        0xffffff,   // ← MUST be white when using vertexColors 
    vertexColors: false,
  }), [])

  if (count === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      frustumCulled={false}
    />
  )
}