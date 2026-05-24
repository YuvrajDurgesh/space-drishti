/**
 * components/globe/GlobeScene.tsx
 * Space Drishti — Main 3D Scene (Updated)
 *
 * Changes:
 *  - hoverInfo state → SatelliteSwarm onHover → SatelliteTooltip
 *  - Click on Earth/background deselects satellite
 *  - DPR capped at 1.5x for performance
 *  - Auto-rotate pauses on hover too (not just on select)
 */

'use client'

import { Suspense, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { SatelliteSwarm } from './SatelliteSwarm'
import type { HoverInfo } from './SatelliteSwarm'
import { OrbitTrail } from './OrbitTrail'
import { SatelliteHUD } from '../ui/SatelliteHUD'
import { SatelliteTooltip } from '../ui/SatelliteTooltip'
import type { SatelliteSummary } from '@/lib/validators'

// ─── Earth ────────────────────────────────────────────────────────────────────

function Earth({ onClickBackground }: { onClickBackground: () => void }) {
  const earthRef  = useRef<THREE.Mesh>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)

  const [dayMap, normalMap, specularMap, cloudsMap] = useTexture([
    '/textures/earth_daymap.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
    '/textures/earth_clouds.jpg',
  ])

  useFrame((_, delta) => {
    if (earthRef.current)  earthRef.current.rotation.y  += delta * 0.02
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.023
  })

  return (
    <group>
      <mesh ref={earthRef} onClick={onClickBackground}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={dayMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={new THREE.Color(0x333333)}
          shininess={15}
        />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.005, 64, 64]} />
        <meshPhongMaterial map={cloudsMap} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.02, 64, 64]} />
        <meshLambertMaterial
          color={0x4488ff} transparent opacity={0.06}
          side={THREE.FrontSide} blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.08, 64, 64]} />
        <meshLambertMaterial
          color={0x2255cc} transparent opacity={0.025}
          side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function SceneLighting() {
  return (
    <>
      <directionalLight position={[5, 3, 5]} intensity={1.8} color={0xfff5e0} />
      <ambientLight intensity={0.08} color={0x112244} />
      <hemisphereLight args={[0x223355, 0x000000, 0.15]} />
    </>
  )
}

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={0x1a2a4a} wireframe />
    </mesh>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface GlobeSceneProps {
  satellites: SatelliteSummary[]
  isLoading?: boolean
}

export function GlobeScene({ satellites, isLoading = false }: GlobeSceneProps) {
  const [selectedSat, setSelectedSat] = useState<SatelliteSummary | null>(null)
  const [hoverInfo,   setHoverInfo]   = useState<HoverInfo | null>(null)

  const handleSelect   = useCallback((sat: SatelliteSummary | null) => setSelectedSat(sat), [])
  const handleHover    = useCallback((info: HoverInfo | null) => setHoverInfo(info), [])
  const handleDeselect = useCallback(() => setSelectedSat(null), [])

  return (
    <div className="relative w-full h-full">
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        camera={{ fov: 45, near: 0.01, far: 1000, position: [0, 0.5, 3.5] }}
        style={{ background: '#010409' }}
        performance={{ min: 0.5 }}
      >
        <SceneLighting />
        <Stars radius={200} depth={50} count={5000} factor={3} fade speed={0.2} />

        <Suspense fallback={<LoadingFallback />}>
          <Earth onClickBackground={handleDeselect} />

          {!isLoading && satellites.length > 0 && (
            <SatelliteSwarm
              satellites={satellites}
              selectedId={selectedSat?.norad_id ?? null}
              onSelect={handleSelect}
              onHover={handleHover}
            />
          )}

          {selectedSat && (
            <OrbitTrail
              tle={{ line1: selectedSat.tle_line1, line2: selectedSat.tle_line2 }}
              periodMinutes={selectedSat.period_minutes ?? 90}
            />
          )}
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={1.2}
          maxDistance={15}
          rotateSpeed={0.4}
          zoomSpeed={0.8}
          autoRotate={!selectedSat && !hoverInfo}
          autoRotateSpeed={0.15}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>

      {/* HTML overlays */}
      <SatelliteTooltip info={hoverInfo} />

      {selectedSat && (
        <SatelliteHUD satellite={selectedSat} onClose={handleDeselect} />
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-cyan-400 text-sm font-mono tracking-widest uppercase">
              Loading Catalog
            </p>
          </div>
        </div>
      )}
    </div>
  )
}