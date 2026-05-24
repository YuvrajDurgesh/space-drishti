/**
 * components/ui/SatelliteTooltip.tsx
 * Space Drishti — Hover Tooltip (Fixed colors)
 *
 * Fix: Added explicit text-white and solid background.
 * Tailwind's default text color can be black depending on base styles.
 */

'use client'

import type { HoverInfo } from '@/components/globe/SatelliteSwarm'

const CATEGORY_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  PAYLOAD:     { dot: '#00d4ff', label: 'Payload',      text: '#00d4ff' },
  ROCKET_BODY: { dot: '#ff8c00', label: 'Rocket Body',  text: '#ff8c00' },
  DEBRIS:      { dot: '#ff3333', label: 'Debris',       text: '#ff4444' },
  UNKNOWN:     { dot: '#aaaaaa', label: 'Unknown',      text: '#aaaaaa' },
}

interface SatelliteTooltipProps {
  info: HoverInfo | null
}

export function SatelliteTooltip({ info }: SatelliteTooltipProps) {
  if (!info) return null

  const style = CATEGORY_STYLE[info.category] ?? CATEGORY_STYLE.UNKNOWN

  return (
    <div
      style={{
        position:        'absolute',
        left:            info.x + 16,
        top:             info.y - 12,
        pointerEvents:   'none',
        zIndex:          50,
        padding:         '6px 10px',
        borderRadius:    '8px',
        border:          '1px solid rgba(255,255,255,0.12)',
        background:      'rgba(5, 10, 20, 0.95)',
        backdropFilter:  'blur(12px)',
        boxShadow:       '0 4px 24px rgba(0,0,0,0.6)',
        maxWidth:        '220px',
        minWidth:        '120px',
      }}
    >
      {/* Satellite name */}
      <p style={{
        margin:      0,
        color:       '#ffffff',
        fontSize:    '12px',
        fontFamily:  'monospace',
        fontWeight:  600,
        lineHeight:  1.4,
        whiteSpace:  'nowrap',
        overflow:    'hidden',
        textOverflow:'ellipsis',
      }}>
        {info.name}
      </p>

      {/* Category + NORAD ID */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '5px',
        marginTop:  '3px',
      }}>
        {/* Color dot */}
        <span style={{
          display:      'inline-block',
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   style.dot,
          flexShrink:   0,
        }} />

        <p style={{
          margin:     0,
          color:      style.text,
          fontSize:   '10px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>
          {style.label} · #{info.norad_id}
        </p>
      </div>
    </div>
  )
}