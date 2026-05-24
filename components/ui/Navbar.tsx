/**
 * components/ui/Navbar.tsx
 * Space Drishti — Top navigation bar
 * Add this to app/layout.tsx
 */

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const LINKS = [
  { href: '/',          label: 'Globe',    icon: '🌍' },
  { href: '/research',  label: 'Research', icon: '🔬' },
  { href: '/about',    label: 'About',    icon: 'ℹ️' },
]

export function Navbar() {
  const path = usePathname()

  return (
    <nav style={{
      position:       'fixed',
      top:            12,
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:         200,
      display:        'flex',
      gap:            4,
      padding:        '4px',
      background:     'rgba(8,14,26,0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border:         '1px solid rgba(255,255,255,0.08)',
      borderRadius:   12,
    }}>
      {LINKS.map(link => {
        const active = path === link.href
        return (
          <Link key={link.href} href={link.href} style={{
            padding:        '6px 16px',
            borderRadius:   8,
            background:     active ? 'rgba(0,212,255,0.12)' : 'transparent',
            border:         active ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent',
            color:          active ? '#00d4ff' : '#555',
            fontFamily:     'monospace',
            fontSize:       12,
            textDecoration: 'none',
            transition:     'all 0.15s',
          }}>
            {link.icon} {link.label}
          </Link>
        )
      })}
    </nav>
  )
}