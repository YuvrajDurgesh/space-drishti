/**
 * components/globe/OrbitTrail.tsx
 * Space Drishti — Orbital Trail Renderer (Fixed)
 *
 * Fix: Used <primitive object={...}> instead of <line> JSX tag.
 * The <line> JSX tag conflicts with SVGLineElement in TypeScript when
 * @types/react includes SVG types. Using <primitive> bypasses this entirely
 * and is the idiomatic R3F pattern for raw Three.js objects.
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as satellite from 'satellite.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371
const SCALE = 1 / EARTH_RADIUS_KM

// ─── Types ────────────────────────────────────────────────────────────────────

interface TLEPair {
  line1: string
  line2: string
}

interface OrbitTrailProps {
  tle:           TLEPair
  periodMinutes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eciToVec3(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x * SCALE, z * SCALE, -y * SCALE)
}

function safePropagate(
  satrec: satellite.SatRec,
  date: Date
): satellite.EciVec3<number> | null {
  try {
    const result = satellite.propagate(satrec, date)
    if (!result?.position || typeof result.position === 'boolean') return null
    const pos = result.position as satellite.EciVec3<number>
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return null
    return pos
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrbitTrail({ tle, periodMinutes }: OrbitTrailProps) {
  // Build Two Line objects for primitive rendering
  const [trailLine, setTrailLine]   = useState<THREE.Line | null>(null)
  const [glowLine,  setGlowLine]    = useState<THREE.Line | null>(null)

  useEffect(() => {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2)
    const now    = Date.now()

    // Sample one full orbit every 30 seconds
    const stepMs  = 30 * 1000
    const totalMs = Math.min(periodMinutes, 200) * 60 * 1000  // cap at 200 min
    const points: THREE.Vector3[] = []

    for (let offset = 0; offset <= totalMs; offset += stepMs) {
      const pos = safePropagate(satrec, new Date(now + offset))
      if (pos) points.push(eciToVec3(pos.x, pos.y, pos.z))
    }

    if (points.length < 2) return

    // Close the loop
    points.push(points[0].clone())

    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    // Main trail
    const main = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color:       0x00d4ff,
        transparent: true,
        opacity:     0.6,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      })
    )

    // Glow layer
    const glow = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color:       0x0044ff,
        transparent: true,
        opacity:     0.2,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      })
    )

    setTrailLine(main)
    setGlowLine(glow)

    // Cleanup on unmount / tle change
    return () => {
      geometry.dispose()
      main.material.dispose()
      glow.material.dispose()
    }
  }, [tle.line1, tle.line2, periodMinutes])

  if (!trailLine || !glowLine) return null

  return (
    <group>
      {/* 
        Fix: <primitive object={...}> is the correct R3F way to render
        a raw Three.js object. Avoids the SVGLineElement TypeScript conflict
        that <line geometry={...}> triggers.
      */}
      <primitive object={trailLine} />
      <primitive object={glowLine}  />
    </group>
  )
}