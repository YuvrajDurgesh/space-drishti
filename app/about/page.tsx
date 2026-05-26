/**
 * app/about/page.tsx
 * Space Drishti — Public Landing / About Page
 *
 * Route: /about
 * Purpose: Public-facing page for sharing on social media, GitHub README, etc.
 *
 * HOW TO SET UP:
 * 1. Copy this file to app/about/page.tsx
 * 2. Open http://localhost:3000/about
 *
 * Globe stays at /          (app/page.tsx — unchanged)
 * Research stays at /research  (app/research/page.tsx — unchanged)
 * This page lives at /about
 *
 * Navbar will automatically show "About" link after you add it to Navbar.tsx
 */

'use client'

import Link from 'next/link'

// ─── Donate button ────────────────────────────────────────────────────────────

function DonateButton() {
  return (
    <a
      href="https://razorpay.me/@galaxyium"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '8px',
        padding:        '12px 24px',
        borderRadius:   '10px',
        background:     'linear-gradient(135deg, #072635 0%, #0a3d55 100%)',
        border:         '1px solid rgba(0,157,224,0.35)',
        color:          '#00d4ff',
        fontFamily:     'monospace',
        fontSize:       '13px',
        fontWeight:     700,
        textDecoration: 'none',
        letterSpacing:  '0.04em',
        transition:     'all 0.2s',
        boxShadow:      '0 0 20px rgba(0,157,224,0.1)',
        cursor:         'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'linear-gradient(135deg, #0a3d55 0%, #0d5070 100%)'
        e.currentTarget.style.boxShadow  = '0 0 28px rgba(0,157,224,0.25)'
        e.currentTarget.style.transform  = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'linear-gradient(135deg, #072635 0%, #0a3d55 100%)'
        e.currentTarget.style.boxShadow  = '0 0 20px rgba(0,157,224,0.1)'
        e.currentTarget.style.transform  = 'translateY(0)'
      }}
    >
      {/* Razorpay logo color */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20.5 12C20.5 16.694 16.694 20.5 12 20.5C7.306 20.5 3.5 16.694 3.5 12C3.5 7.306 7.306 3.5 12 3.5C16.694 3.5 20.5 7.306 20.5 12Z" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" strokeWidth="1.2"/>
        <path d="M8 15L11 9L14 12L17 9" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Support this project
    </a>
  )
}

// ─── Reusable components ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           '12px',
      fontSize:      '10px',
      color:         '#00d4ff',
      letterSpacing: '0.2em',
      textTransform: 'uppercase' as const,
      fontFamily:    'monospace',
      marginBottom:  '16px',
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  )
}

function FeatureCard({
  icon, title, desc, tag, accentColor = '#00d4ff'
}: {
  icon: string; title: string; desc: string; tag: string; accentColor?: string
}) {
  return (
    <div style={{
      padding:    '28px',
      background: 'rgba(255,255,255,0.025)',
      border:     '1px solid rgba(255,255,255,0.07)',
      position:   'relative',
      overflow:   'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
      }} />
      <div style={{ fontSize: 26, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#e8edf5', marginBottom: 8 }}>
        {title}
      </div>
      <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.8, marginBottom: 14 }}>{desc}</p>
      <span style={{
        padding:       '3px 8px',
        fontSize:      9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        background:    `${accentColor}12`,
        color:         accentColor,
        border:        `1px solid ${accentColor}25`,
        fontFamily:    'monospace',
      }}>
        {tag}
      </span>
    </div>
  )
}

function AudienceCard({
  label, title, items
}: {
  label: string; title: string; items: string[]
}) {
  return (
    <div style={{
      padding:    '36px',
      border:     '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#334455', fontFamily: 'monospace', marginBottom: 16 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e8edf5', marginBottom: 20 }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.7, paddingLeft: 20, position: 'relative' as const }}>
            <span style={{ position: 'absolute', left: 0, color: '#00d4ff' }}>→</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #010409; }
        .stars-bg {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            radial-gradient(1px 1px at 8%  15%, rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 65%, rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 52% 12%, rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1px 1px at 78% 80%, rgba(255,255,255,0.30) 0%, transparent 100%),
            radial-gradient(1px 1px at 91% 38%, rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px 1px at 18% 88%, rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 63% 52%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 44% 32%, rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1px 1px at 35% 45%, rgba(255,255,255,0.20) 0%, transparent 100%),
            radial-gradient(1px 1px at 87% 22%, rgba(255,255,255,0.40) 0%, transparent 100%);
        }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      <div className="stars-bg" />

      <main style={{
        minHeight:  '100vh',
        background: 'transparent',
        color:      '#e8edf5',
        fontFamily: 'Space Mono, monospace',
        position:   'relative',
        zIndex:     1,
        paddingTop: 80,  // space for fixed Navbar
      }}>

        {/* ── HERO ── */}
        <section style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 680 }}>

            {/* Live badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderRadius: 20, marginBottom: 32,
              border: '1px solid rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.06)',
              fontSize: 10, color: '#00d4ff', letterSpacing: '0.15em',
            }}>
              <div style={{ width: 5, height: 5, background: '#00d4ff', borderRadius: '50%', animation: 'pulse-dot 1.5s infinite' }} />
              34,000+ OBJECTS TRACKED · LIVE
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: "'Syne', sans-serif", lineHeight: 0.92, marginBottom: 14, letterSpacing: '-0.02em' }}>
              <span style={{ display: 'block', fontSize: 'clamp(52px, 10vw, 96px)', fontWeight: 800, color: '#e8edf5' }}>
                SPACE
              </span>
              <span style={{
                display: 'block', fontSize: 'clamp(52px, 10vw, 96px)', fontWeight: 800,
                background: 'linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                DRISHTI
              </span>
            </h1>

            <p style={{ fontSize: 'clamp(13px, 2vw, 16px)', color: '#334455', letterSpacing: '0.12em', marginBottom: 28, fontFamily: "'Syne', sans-serif" }}>
              अंतरिक्ष दृष्टि — Space Vision for India
            </p>

            <p style={{ fontSize: 13, color: '#4a5a6a', lineHeight: 1.9, maxWidth: 520, margin: '0 auto 44px' }}>
              Open-source Space Situational Awareness platform. Track every satellite and debris fragment in real-time 3D. Built for Indian researchers, scientists, and the growing new space ecosystem.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
              <Link href="/" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 12,
                background: '#00d4ff', color: '#000', fontWeight: 700,
                textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}>
                Open Globe →
              </Link>
              <Link href="/research" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 12,
                background: 'transparent', color: '#e8edf5',
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
              }}>
                Research Tools
              </Link>
              <a href="https://github.com/YuvrajDurgesh/space-drishti" target="_blank" rel="noopener noreferrer" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 12,
                background: 'transparent', color: '#e8edf5',
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
              }}>
                GitHub ↗
              </a>
            </div>

            {/* Donate */}
            <DonateButton />
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '36px 24px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { num: '34k+',  label: 'Objects Tracked' },
              { num: '2×',    label: 'Daily TLE Sync' },
              { num: '5',     label: 'ISRO Stations' },
              { num: 'MIT',   label: 'Open Source' },
            ].map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '0 20px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, color: '#00d4ff', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 10, color: '#334455', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section style={{ padding: '100px 24px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionLabel>Platform Features</SectionLabel>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, marginBottom: 16, lineHeight: 1.1 }}>
              Everything an SSA<br/>researcher needs.
            </h2>
            <p style={{ fontSize: 13, color: '#4a5a6a', lineHeight: 1.9, maxWidth: 520, marginBottom: 64 }}>
              From real-time visualization to scientific analysis tools — all in one open platform, free forever.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 2 }}>
              <FeatureCard icon="🌍" title="Real-Time 3D Globe" accentColor="#00d4ff"
                desc="34,000+ objects rendered in WebGL at 60 FPS using GPU instanced mesh. Color-coded by type. Click any object for live telemetry — altitude, speed, lat/lon updated every 5 seconds."
                tag="SGP4 Propagation" />
              <FeatureCard icon="⚠️" title="Conjunction Analysis" accentColor="#ff3333"
                desc="Detect close approaches between any satellite and the full catalog. Two-pass scan over a 1–7 day window. Returns miss distance, relative velocity, and probability of collision."
                tag="Chan Pc Model" />
              <FeatureCard icon="📉" title="Orbital Decay Predictor" accentColor="#ff8c00"
                desc="Estimate re-entry dates using BSTAR drag term and numerical integration. Shows altitude decay sparkline over time with confidence rating. Best for objects below 600 km."
                tag="BSTAR Numerical Model" />
              <FeatureCard icon="📡" title="Pass Prediction" accentColor="#4ec9b0"
                desc="AOS/LOS timing for all 5 ISRO ISTRAC stations. Shows max elevation, azimuth at rise/set, duration, range, and sunlit indicator. Predict up to 72 hours ahead."
                tag="5 ISRO Stations" />
              <FeatureCard icon="🔌" title="REST API" accentColor="#00d4ff"
                desc="Every feature is accessible via API. Query satellite positions, run conjunction analysis, get decay predictions. Integrate directly into Python, MATLAB, or Julia scripts."
                tag="No Auth Required" />
              <FeatureCard icon="🔄" title="Auto-Sync Pipeline" accentColor="#8888ff"
                desc="GitHub Actions cron pulls fresh TLE data from Space-Track.org twice daily at 11:30 IST and 23:30 IST. Smart epoch deduplication builds a historical archive automatically."
                tag="GitHub Actions" />
            </div>
          </div>
        </section>

        {/* ── WHO IS IT FOR ── */}
        <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionLabel>Who Uses Space Drishti</SectionLabel>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, marginBottom: 56, lineHeight: 1.1 }}>
              Built for India's<br/>space ecosystem.
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              <AudienceCard
                label="For Researchers & Scientists"
                title="Scientific Analysis Tools"
                items={[
                  'Run conjunction screening without access to classified CDM feeds',
                  'Study orbital decay behavior across debris populations',
                  'Access ECI state vectors for any object at any timestamp via API',
                  'Compute ISRO ground station pass schedules for mission planning',
                  'Use the open REST API in Python / MATLAB / Julia scripts',
                  'Analyze historical TLE archive built automatically by the sync pipeline',
                ]}
              />
              <AudienceCard
                label="For Space Startups"
                title="Mission Infrastructure"
                items={[
                  'Know exactly when your satellite passes over Indian ground stations',
                  'Screen launch orbits for conjunction risks before deployment',
                  'Monitor your satellite\'s orbital decay rate in real-time',
                  'Embed pass prediction into your ground software via REST API',
                  'Self-host the entire platform on your own infrastructure',
                  'No per-call pricing, no vendor lock-in — MIT licensed',
                ]}
              />
              <AudienceCard
                label="For Students & Educators"
                title="Learn Orbital Mechanics"
                items={[
                  'See SGP4 propagation working live on real TLE data',
                  'Build on top of the open codebase for thesis projects',
                  'Understand conjunction analysis with real probability estimates',
                  'Use the 3D globe for classroom demonstrations',
                  'Full Next.js + Three.js + satellite.js codebase to learn from',
                  'Great starting point for ISRO internship projects',
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── API SECTION ── */}
        <section style={{ padding: '100px 24px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, alignItems: 'start' }}>
            <div>
              <SectionLabel>REST API</SectionLabel>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, marginBottom: 16, lineHeight: 1.1 }}>
                Integrate into<br/>your own tools.
              </h2>
              <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.9, marginBottom: 24 }}>
                Every feature in the platform is also a REST endpoint. Use it from Python, MATLAB, Julia, or any HTTP client. No API key needed on self-hosted instances.
              </p>
              <a href="/api/satellites?limit=5" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', padding: '9px 18px', borderRadius: 8, fontSize: 11,
                background: 'transparent', color: '#e8edf5',
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none', fontFamily: 'monospace',
              }}>
                Try Live API ↗
              </a>
            </div>

            {/* Code block */}
            <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
                <span style={{ fontSize: 10, color: '#334455', fontFamily: 'monospace', marginLeft: 6, letterSpacing: '0.08em' }}>REST API Examples</span>
              </div>
              <pre style={{ padding: '20px', fontSize: 11, lineHeight: 1.8, color: '#8899aa', fontFamily: 'monospace', overflowX: 'auto' }}>
{`\u001b[2m# Satellite catalog with filters\u001b[0m
`}
                <span style={{ color: '#00d4ff' }}>GET</span>{` /api/satellites`}<span style={{ color: '#ff8c00' }}>?category=DEBRIS&origin=IND</span>{`

`}<span style={{ color: '#555' }}># Live ECI position + trail</span>{`
`}<span style={{ color: '#00d4ff' }}>GET</span>{` /api/satellite/25544`}<span style={{ color: '#ff8c00' }}>?trail_minutes=90</span>{`

`}<span style={{ color: '#555' }}># Conjunction analysis</span>{`
`}<span style={{ color: '#00d4ff' }}>POST</span>{` /api/conjunction
`}<span style={{ color: '#4ec9b0' }}>{`{ "norad_id": 25544, "window_days": 3 }`}</span>{`

`}<span style={{ color: '#555' }}># Orbital decay prediction</span>{`
`}<span style={{ color: '#00d4ff' }}>GET</span>{` /api/decay/99025

`}<span style={{ color: '#555' }}># Pass times for ISRO Bangalore</span>{`
`}<span style={{ color: '#00d4ff' }}>GET</span>{` /api/passes/25544`}<span style={{ color: '#ff8c00' }}>?station=ISTRAC-BLR&hours=48</span>
              </pre>
            </div>
          </div>
        </section>

        {/* ── GROUND STATIONS ── */}
        <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionLabel>Ground Infrastructure</SectionLabel>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, marginBottom: 12, lineHeight: 1.1 }}>
              ISRO ISTRAC Network.
            </h2>
            <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.9, marginBottom: 40 }}>
              Pass prediction built around India's primary tracking network. Get AOS/LOS for any station, or all five at once.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {[
                { name: 'ISTRAC Bangalore',          loc: '12.97°N, 77.59°E · 920m', band: 'S · X Band', id: 'ISTRAC-BLR' },
                { name: 'ISTRAC Lucknow',            loc: '26.84°N, 80.94°E · 120m', band: 'S Band',     id: 'ISTRAC-LKO' },
                { name: 'ISTRAC Mauritius',          loc: '20.16°S, 57.49°E · 60m',  band: 'S · X Band', id: 'ISTRAC-MUS' },
                { name: 'ISTRAC Port Blair',         loc: '11.62°N, 92.72°E · 30m',  band: 'S Band',     id: 'ISTRAC-PBL' },
                { name: 'ISTRAC Thiruvananthapuram', loc: '8.52°N, 76.93°E · 30m',   band: 'S · X Band', id: 'ISTRAC-TVM' },
              ].map(s => (
                <div key={s.id} style={{ padding: '18px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: 11, color: '#e8edf5', fontWeight: 700, marginBottom: 4, fontFamily: 'monospace' }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: '#334455', fontFamily: 'monospace', marginBottom: 8 }}>{s.loc}</div>
                  <span style={{
                    padding: '2px 7px', fontSize: 9, letterSpacing: '0.1em',
                    background: 'rgba(0,212,255,0.08)', color: '#00d4ff',
                    border: '1px solid rgba(0,212,255,0.2)', fontFamily: 'monospace',
                  }}>
                    {s.band}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LICENSE ── */}
        <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ padding: '32px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 24, marginBottom: 16 }}>⚖️</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e8edf5', marginBottom: 10 }}>MIT License</div>
              <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.8 }}>
                Free to use, modify, and distribute — commercially or personally. No restrictions. Attribution appreciated but not required. Fork it and build something great.
              </p>
            </div>
            <div style={{ padding: '32px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 24, marginBottom: 16 }}>📡</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e8edf5', marginBottom: 10 }}>Data Source</div>
              <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.8 }}>
                TLE data from <a href="https://www.space-track.org" target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff' }}>Space-Track.org</a> (18th Space Defense Squadron, US Space Command). Free account required. Auto-synced twice daily.
              </p>
            </div>
            <div style={{ padding: '32px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 24, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e8edf5', marginBottom: 10 }}>Disclaimer</div>
              <p style={{ fontSize: 12, color: '#4a5a6a', lineHeight: 1.8 }}>
                Research-grade tool. Conjunction Pc values and decay predictions are estimates, not operational warnings. Do not use for spacecraft operations without independent validation.
              </p>
            </div>
          </div>
        </section>

        {/* ── DONATE + OSS CTA ── */}
        <section style={{ padding: '100px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 20, marginBottom: 28,
              border: '1px solid rgba(0,157,224,0.2)', background: 'rgba(0,157,224,0.05)',
              fontSize: 10, color: '#00a8d4', letterSpacing: '0.15em', fontFamily: 'monospace',
            }}>
              ⭐ OPEN SOURCE · FREE FOREVER
            </div>

            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, marginBottom: 16, lineHeight: 1.05 }}>
              Built for India's<br/>Space Future.
            </h2>
            <p style={{ fontSize: 13, color: '#4a5a6a', lineHeight: 1.9, marginBottom: 40 }}>
              Every line of code is public. Fork it, extend it, self-host it. If this platform saved you time or helped your research, consider supporting its development.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 12,
                background: '#00d4ff', color: '#000', fontWeight: 700,
                textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.05em',
              }}>
                Open Platform →
              </Link>
              <a href="https://github.com/YuvrajDurgesh/space-drishti" target="_blank" rel="noopener noreferrer" style={{
                padding: '13px 28px', borderRadius: 10, fontSize: 12,
                background: 'transparent', color: '#e8edf5',
                border: '1px solid rgba(255,255,255,0.1)',
                textDecoration: 'none', fontFamily: 'monospace',
              }}>
                GitHub ↗
              </a>
              <DonateButton />
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#223344', fontFamily: 'monospace' }}>
              Space Drishti · MIT License · Built for India's space research community
            </span>
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Globe',      href: '/' },
                { label: 'Research',   href: '/research' },
                { label: 'GitHub',     href: 'https://github.com/YuvrajDurgesh/space-drishti' },
                { label: 'Space-Track', href: 'https://www.space-track.org' },
              ].map(l => (
                <a key={l.label} href={l.href} style={{ fontSize: 11, color: '#334455', fontFamily: 'monospace', textDecoration: 'none' }}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </footer>

      </main>
    </>
  )
}