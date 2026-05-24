/**
 * app/research/page.tsx
 * Space Drishti — Researcher Dashboard
 *
 * 3 tabs:
 *  1. Conjunction Analysis — search any satellite, run close-approach scan
 *  2. Decay Predictor      — re-entry forecast with altitude sparkline
 *  3. Pass Prediction      — AOS/LOS times for ISRO ground stations
 *
 * Design: same glassmorphism dark system as globe page.
 * No external chart library needed — sparkline drawn with inline SVG.
 */

'use client'

import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SatSearchResult {
  norad_id:            number
  name:                string
  category:            string
  altitude_perigee_km: number | null
  altitude_apogee_km:  number | null
  period_minutes:      number | null
  origin_country:      string | null
}

interface ConjunctionEvent {
  object2_norad_id:         number
  object2_name:             string
  tca:                      string
  miss_distance_km:         number
  relative_speed_km_s:      number
  probability_of_collision: number
  severity:                 'CRITICAL' | 'WARNING' | 'NOMINAL'
}

interface DecayResult {
  norad_id:            number
  name:                string
  perigee_km:          number
  apogee_km:           number
  period_min:          number
  bstar:               number
  predicted_decay_at:  string | null
  days_until_decay:    number | null
  uncertainty_days:    number | null
  altitude_trail:      { day: number; perigee_km: number; apogee_km: number }[]
  confidence:          'HIGH' | 'MEDIUM' | 'LOW'
  warning?:            string
}

interface PassEvent {
  station_name:      string
  station_id:        string
  aos:               string
  tca:               string
  los:               string
  duration_sec:      number
  max_elevation_deg: number
  aos_azimuth_deg:   number
  los_azimuth_deg:   number
  min_range_km:      number
  is_sunlit:         boolean
}

type TabId = 'conjunction' | 'decay' | 'passes'

// ─── Design tokens ────────────────────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:            'rgba(8,14,26,0.85)',
  backdropFilter:        'blur(16px)',
  WebkitBackdropFilter:  'blur(16px)',
  border:                '1px solid rgba(255,255,255,0.08)',
  borderRadius:          '12px',
}

const CARD: React.CSSProperties = {
  background:   'rgba(255,255,255,0.03)',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px',
  padding:      '14px 16px',
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: 'rgba(255,50,50,0.12)',  text: '#ff5555', dot: '#ff3333' },
  WARNING:  { bg: 'rgba(255,140,0,0.12)',  text: '#ffaa33', dot: '#ff8c00' },
  NOMINAL:  { bg: 'rgba(0,212,255,0.08)',  text: '#00d4ff', dot: '#00d4ff' },
}

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH:   '#00d4ff',
  MEDIUM: '#ff8c00',
  LOW:    '#888888',
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      {children}
    </span>
  )
}

function Value({ children, color = '#ccc' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 13, fontFamily: 'monospace', color, fontWeight: 500 }}>
      {children}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#00d4ff', fontFamily: 'monospace', fontSize: 12, padding: '24px 0' }}>
      <div style={{
        width: 14, height: 14,
        border: '2px solid rgba(0,212,255,0.3)',
        borderTopColor: '#00d4ff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Computing…
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: '#444', fontFamily: 'monospace', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>{text}</p>
}

// ─── Satellite search input ───────────────────────────────────────────────────

function SatSearch({
  onSelect,
  placeholder = 'Search satellite name or NORAD ID…',
}: {
  onSelect: (sat: SatSearchResult) => void
  placeholder?: string
}) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SatSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const isId  = /^\d+$/.test(q)
      const url   = isId
        ? `/api/satellites?limit=10&search=${q}`
        : `/api/satellites?limit=10&search=${encodeURIComponent(q)}`
      const res   = await fetch(url)
      const data  = await res.json()
      setResults(data.data ?? [])
      setOpen(true)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => search(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '9px 12px',
          color: '#fff', fontFamily: 'monospace', fontSize: 12,
          outline: 'none',
        }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00d4ff', fontSize: 10 }}>…</div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'rgba(8,14,26,0.98)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
        }}>
          {results.map(sat => (
            <button
              key={sat.norad_id}
              onClick={() => { onSelect(sat); setQuery(sat.name); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', background: 'transparent', border: 'none',
                cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>{sat.name}</div>
              <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 10 }}>
                #{sat.norad_id} · {sat.category} · {sat.altitude_perigee_km ?? '?'} km
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function AltitudeSparkline({ trail }: { trail: DecayResult['altitude_trail'] }) {
  if (trail.length < 2) return null

  const W = 400, H = 80, PAD = 8
  const minAlt = Math.min(...trail.map(t => t.perigee_km))
  const maxAlt = Math.max(...trail.map(t => t.apogee_km))
  const range  = maxAlt - minAlt || 1

  const scaleX = (day: number) => PAD + ((day - trail[0].day) / (trail[trail.length - 1].day - trail[0].day || 1)) * (W - PAD * 2)
  const scaleY = (alt: number) => H - PAD - ((alt - minAlt) / range) * (H - PAD * 2)

  const perigeePoints = trail.map(t => `${scaleX(t.day)},${scaleY(t.perigee_km)}`).join(' ')
  const apogeePoints  = trail.map(t => `${scaleX(t.day)},${scaleY(t.apogee_km)}`).join(' ')

  return (
    <div>
      <Label>Altitude decay trail</Label>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 6, display: 'block' }}>
        {/* Grid line at 300 km warning threshold */}
        {minAlt < 300 && maxAlt > 300 && (
          <line
            x1={PAD} y1={scaleY(300)} x2={W - PAD} y2={scaleY(300)}
            stroke="#ff8c00" strokeWidth={0.5} strokeDasharray="4 3" opacity={0.5}
          />
        )}
        <polyline points={apogeePoints}  fill="none" stroke="#00d4ff" strokeWidth={1} opacity={0.4} />
        <polyline points={perigeePoints} fill="none" stroke="#ff4444" strokeWidth={1.5} />
        {/* Axis labels */}
        <text x={PAD} y={H - 1} fontSize={8} fontFamily="monospace" fill="#444">day 0</text>
        <text x={W - PAD} y={H - 1} fontSize={8} fontFamily="monospace" fill="#444" textAnchor="end">
          day {trail[trail.length - 1].day}
        </text>
        <text x={PAD} y={scaleY(minAlt) - 2} fontSize={8} fontFamily="monospace" fill="#ff4444">
          {Math.round(minAlt)} km
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <span style={{ color: '#ff4444', fontFamily: 'monospace', fontSize: 10 }}>— perigee</span>
        <span style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: 10, opacity: 0.6 }}>— apogee</span>
        <span style={{ color: '#ff8c00', fontFamily: 'monospace', fontSize: 10, opacity: 0.6 }}>- - 300 km threshold</span>
      </div>
    </div>
  )
}

// ─── Tab: Conjunction ─────────────────────────────────────────────────────────

function ConjunctionTab() {
  const [selected, setSelected] = useState<SatSearchResult | null>(null)
  const [windowDays, setWindowDays] = useState(3)
  const [loading,  setLoading]  = useState(false)
  const [results,  setResults]  = useState<ConjunctionEvent[] | null>(null)
  const [meta,     setMeta]     = useState<{ catalog_size: number; total_found: number } | null>(null)

  const run = async () => {
    if (!selected) return
    setLoading(true); setResults(null)
    try {
      const res  = await fetch('/api/conjunction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ norad_id: selected.norad_id, window_days: windowDays }),
      })
      const data = await res.json()
      setResults(data.data ?? [])
      setMeta({ catalog_size: data.catalog_size, total_found: data.total_found })
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label>Target satellite</Label>
        <SatSearch onSelect={setSelected} />

        {selected && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <Label>Altitude</Label><br />
              <Value>{selected.altitude_perigee_km ?? '?'} – {selected.altitude_apogee_km ?? '?'} km</Value>
            </div>
            <div>
              <Label>Window</Label><br />
              <select
                value={windowDays}
                onChange={e => setWindowDays(Number(e.target.value))}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '4px 8px', color: '#fff', fontFamily: 'monospace', fontSize: 12,
                }}
              >
                {[1,2,3,5,7].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <button
              onClick={run}
              disabled={loading}
              style={{
                marginLeft: 'auto', padding: '7px 18px',
                background: loading ? 'rgba(0,212,255,0.1)' : 'rgba(0,212,255,0.15)',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8,
                color: '#00d4ff', fontFamily: 'monospace', fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Scanning…' : 'Run Analysis'}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {loading && <Spinner />}

      {meta && (
        <div style={{ display: 'flex', gap: 16, fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
          <span>Screened against <span style={{ color: '#888' }}>{meta.catalog_size}</span> objects</span>
          <span>Found <span style={{ color: '#00d4ff' }}>{meta.total_found}</span> close approaches</span>
        </div>
      )}

      {results && results.length === 0 && (
        <Empty text="No close approaches found within threshold. Orbit is clear." />
      )}

      {results && results.map((evt, i) => {
        const sty = SEVERITY_STYLE[evt.severity]
        return (
          <div key={i} style={{ ...CARD, borderLeft: `3px solid ${sty.dot}`, background: sty.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                  {evt.object2_name}
                </div>
                <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                  NORAD #{evt.object2_norad_id}
                </div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: 'rgba(0,0,0,0.3)', border: `1px solid ${sty.dot}`,
                color: sty.text, fontFamily: 'monospace', fontSize: 10,
              }}>
                {evt.severity}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
              <div><Label>Miss distance</Label><br /><Value color={sty.text}>{evt.miss_distance_km.toFixed(3)} km</Value></div>
              <div><Label>Relative speed</Label><br /><Value>{evt.relative_speed_km_s.toFixed(2)} km/s</Value></div>
              <div><Label>Pc (approx)</Label><br /><Value color="#ff8c00">{(evt.probability_of_collision * 100).toExponential(2)}%</Value></div>
              <div><Label>TCA</Label><br /><Value>{new Date(evt.tca).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Value></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Decay ───────────────────────────────────────────────────────────────

function DecayTab() {
  const [selected, setSelected] = useState<SatSearchResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<DecayResult | null>(null)

  const run = async (sat: SatSearchResult) => {
    setSelected(sat); setLoading(true); setResult(null)
    try {
      const res  = await fetch(`/api/decay/${sat.norad_id}`)
      const data = await res.json()
      setResult(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={CARD}>
        <Label>Satellite</Label>
        <div style={{ marginTop: 8 }}>
          <SatSearch onSelect={run} placeholder="Search satellite to predict decay…" />
        </div>
        <p style={{ color: '#444', fontFamily: 'monospace', fontSize: 10, marginTop: 8 }}>
          Uses BSTAR drag term from TLE. Accuracy ±30%. Not for operational use.
        </p>
      </div>

      {loading && <Spinner />}

      {result && (
        <>
          {/* Summary card */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{result.name}</div>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 10,
                background: 'rgba(0,0,0,0.3)', border: `1px solid ${CONFIDENCE_COLOR[result.confidence]}40`,
                color: CONFIDENCE_COLOR[result.confidence],
              }}>
                {result.confidence} CONFIDENCE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
              <div><Label>Perigee</Label><br /><Value color={result.perigee_km < 300 ? '#ff4444' : '#00d4ff'}>{result.perigee_km} km</Value></div>
              <div><Label>Apogee</Label><br /><Value>{result.apogee_km} km</Value></div>
              <div><Label>Period</Label><br /><Value>{result.period_min} min</Value></div>
              <div><Label>BSTAR drag</Label><br /><Value>{result.bstar.toExponential(3)}</Value></div>
            </div>
          </div>

          {/* Prediction card */}
          <div style={{
            ...CARD,
            borderLeft: `3px solid ${result.days_until_decay ? '#ff4444' : '#555'}`,
            background: result.days_until_decay ? 'rgba(255,50,50,0.07)' : 'rgba(255,255,255,0.02)',
          }}>
            {result.warning ? (
              <div style={{ color: '#888', fontFamily: 'monospace', fontSize: 12 }}>{result.warning}</div>
            ) : result.predicted_decay_at ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <div>
                  <Label>Predicted re-entry</Label><br />
                  <Value color="#ff4444">
                    {new Date(result.predicted_decay_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </Value>
                </div>
                <div>
                  <Label>Days until decay</Label><br />
                  <Value color="#ff8c00">{result.days_until_decay} days</Value>
                </div>
                <div>
                  <Label>Uncertainty</Label><br />
                  <Value>± {result.uncertainty_days} days</Value>
                </div>
              </div>
            ) : null}
          </div>

          {/* Sparkline */}
          {result.altitude_trail.length > 1 && (
            <div style={CARD}>
              <AltitudeSparkline trail={result.altitude_trail} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Passes ──────────────────────────────────────────────────────────────

const STATION_OPTIONS = [
  { id: '', name: 'All ISRO Stations' },
  { id: 'ISTRAC-BLR', name: 'Bangalore' },
  { id: 'ISTRAC-LKO', name: 'Lucknow' },
  { id: 'ISTRAC-MUS', name: 'Mauritius' },
  { id: 'ISTRAC-PBL', name: 'Port Blair' },
  { id: 'ISTRAC-TVM', name: 'Thiruvananthapuram' },
]

function PassesTab() {
  const [selected,  setSelected]  = useState<SatSearchResult | null>(null)
  const [station,   setStation]   = useState('')
  const [hours,     setHours]     = useState(24)
  const [loading,   setLoading]   = useState(false)
  const [passes,    setPasses]    = useState<PassEvent[] | null>(null)

  const run = async (sat?: SatSearchResult) => {
    const target = sat ?? selected
    if (!target) return
    if (sat) setSelected(sat)
    setLoading(true); setPasses(null)
    try {
      const url  = `/api/passes/${target.norad_id}?hours=${hours}${station ? `&station=${station}` : ''}`
      const res  = await fetch(url)
      const data = await res.json()
      setPasses(data.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }
  function secToMin(s: number) {
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label>Satellite</Label>
        <SatSearch onSelect={run} placeholder="Search satellite for pass prediction…" />

        {selected && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <Label>Station</Label><br />
              <select
                value={station}
                onChange={e => setStation(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '4px 8px', color: '#fff', fontFamily: 'monospace', fontSize: 12,
                }}
              >
                {STATION_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Window</Label><br />
              <select
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '4px 8px', color: '#fff', fontFamily: 'monospace', fontSize: 12,
                }}
              >
                {[12, 24, 48, 72].map(h => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <button
              onClick={() => run()}
              disabled={loading}
              style={{
                marginLeft: 'auto', padding: '7px 18px',
                background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)',
                borderRadius: 8, color: '#00d4ff', fontFamily: 'monospace', fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Computing…' : 'Predict Passes'}
            </button>
          </div>
        )}
      </div>

      {loading && <Spinner />}
      {passes && passes.length === 0 && <Empty text="No passes found in this window. Try a longer window or different station." />}

      {passes && passes.map((p, i) => (
        <div key={i} style={{ ...CARD }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
              {p.station_name}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {p.is_sunlit && (
                <span style={{
                  padding: '1px 7px', borderRadius: 4,
                  background: 'rgba(255,200,0,0.12)', border: '1px solid rgba(255,200,0,0.3)',
                  color: '#ffc800', fontFamily: 'monospace', fontSize: 10,
                }}>
                  ☀ Sunlit
                </span>
              )}
              <span style={{
                padding: '1px 7px', borderRadius: 4,
                background: p.max_elevation_deg > 45 ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${p.max_elevation_deg > 45 ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: p.max_elevation_deg > 45 ? '#00d4ff' : '#888',
                fontFamily: 'monospace', fontSize: 10,
              }}>
                MEL {p.max_elevation_deg}°
              </span>
            </div>
          </div>

          {/* Timeline bar: AOS → TCA → LOS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '8px 0', fontFamily: 'monospace', fontSize: 10 }}>
            <div style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ color: '#00d4ff' }}>AOS</div>
              <div style={{ color: '#fff', fontSize: 11 }}>{formatTime(p.aos)}</div>
              <div style={{ color: '#555', fontSize: 9 }}>{formatDate(p.aos)}</div>
              <div style={{ color: '#555', fontSize: 9 }}>{p.aos_azimuth_deg}°</div>
            </div>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #00d4ff, #fff, #00d4ff)', margin: '0 8px', opacity: 0.3 }} />
            <div style={{ textAlign: 'center', minWidth: 56 }}>
              <div style={{ color: '#fff' }}>TCA</div>
              <div style={{ color: '#fff', fontSize: 11 }}>{formatTime(p.tca)}</div>
              <div style={{ color: '#555', fontSize: 9 }}>{p.min_range_km} km</div>
            </div>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #00d4ff, #fff, #00d4ff)', margin: '0 8px', opacity: 0.3 }} />
            <div style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ color: '#ff6666' }}>LOS</div>
              <div style={{ color: '#fff', fontSize: 11 }}>{formatTime(p.los)}</div>
              <div style={{ color: '#555', fontSize: 9 }}>{formatDate(p.los)}</div>
              <div style={{ color: '#555', fontSize: 9 }}>{p.los_azimuth_deg}°</div>
            </div>
          </div>

          <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 10, marginTop: 6 }}>
            Duration: <span style={{ color: '#888' }}>{secToMin(p.duration_sec)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Nav link to globe ────────────────────────────────────────────────────────

function BackToGlobe() {
  return (
    <a href="/" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      color: '#555', fontFamily: 'monospace', fontSize: 11,
      textDecoration: 'none', marginBottom: 4,
    }}
    onMouseEnter={e => (e.currentTarget.style.color = '#888')}
    onMouseLeave={e => (e.currentTarget.style.color = '#555')}
    >
      ← Globe
    </a>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'conjunction', label: 'Conjunction', icon: '⚠' },
  { id: 'decay',       label: 'Decay',       icon: '↓' },
  { id: 'passes',      label: 'Passes',      icon: '📡' },
]

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabId>('conjunction')

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #010409; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        option { background: #0d1117; color: #fff; }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#010409', padding: '24px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Header */}
          <BackToGlobe />
          <div style={{ ...GLASS, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, background: '#00d4ff', borderRadius: '50%', animation: 'spin 3s linear infinite', boxShadow: '0 0 6px #00d4ff' }} />
                <h1 style={{ color: '#fff', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: '0.1em' }}>
                  SPACE DRISHTI · RESEARCH
                </h1>
              </div>
              <p style={{ color: '#444', fontFamily: 'monospace', fontSize: 10, marginTop: 4, letterSpacing: '0.08em' }}>
                Scientific analysis toolkit for SSA researchers
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '9px 4px',
                  background: activeTab === tab.id ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: activeTab === tab.id ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, cursor: 'pointer',
                  color: activeTab === tab.id ? '#00d4ff' : '#555',
                  fontFamily: 'monospace', fontSize: 12,
                  transition: 'all 0.15s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {activeTab === 'conjunction' && <ConjunctionTab />}
            {activeTab === 'decay'       && <DecayTab />}
            {activeTab === 'passes'      && <PassesTab />}
          </div>

        </div>
      </main>
    </>
  )
}