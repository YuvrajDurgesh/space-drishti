# 🛰️ Space Drishti

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Donate via Razorpay](https://img.shields.io/badge/Razorpay-Support_Project-00d4ff?style=flat&logo=razorpay)](https://razorpay.me/@galaxyium)

**An open-source Space Situational Awareness (SSA) platform built for Indian students, startups, and researchers.**

Space Drishti democratizes access to space object tracking data by combining ISRO-relevant ground station data, real-time TLE propagation, and a high-performance 3D visualization engine — all in a single open-source web application.

---

## What is Space Drishti?

Space Drishti (दृष्टि = *vision*) is a web-based SSA dashboard that tracks 34,000+ objects currently orbiting Earth — active satellites, rocket bodies, and debris fragments — and provides researchers with scientific tools to analyze their behavior.

The platform pulls live TLE (Two-Line Element) data from [Space-Track.org](https://www.space-track.org) (operated by US Space Command), processes it through a PostgreSQL database, and renders it on an interactive 3D Earth using WebGL.

---

## Live Features

### 🌍 3D Globe (/)

| Feature | Description |
|---|---|
| **Real-time satellite positions** | 34,000+ objects rendered as colored dots, positions updated every 2 seconds using SGP4/SDP4 propagation |
| **Category color coding** | Cyan = Payloads · Amber = Rocket Bodies · Red = Debris |
| **Hover tooltip** | Hover any dot → satellite name, category, NORAD ID |
| **Click for full HUD** | Click any satellite → live lat/lon/altitude/speed panel, updates every 5 seconds |
| **Orbital trail** | Selected satellite's predicted orbit path drawn for one full revolution |
| **Filter toolbar** | Filter by category (Payload/Rocket Body/Debris), active-only toggle, name search |
| **Stats panel** | Live count of objects by category + last sync timestamp |

### 🔬 Researcher Dashboard (/research)

Three scientific analysis tools accessible via the top navigation bar:

---

#### Tool 1 — Conjunction Analysis

Detects predicted **close approaches** between any two tracked objects.

**How to use:**
1. Open `/research` → click **Conjunction** tab
2. Search for a satellite by name or NORAD ID (e.g. `ISS` or `25544`)
3. Set the analysis window (1–7 days)
4. Click **Run Analysis**

The engine screens the target against all objects within ±200 km of its altitude, runs a two-pass scan (coarse at 60s intervals → fine at 1s), and returns:

- **Miss distance** (km) at Time of Closest Approach (TCA)
- **Relative speed** (km/s)
- **Probability of collision** (Pc) — simplified Chan 2008 estimate
- **Severity** — CRITICAL (<1 km) · WARNING (<10 km) · NOMINAL

> **Note:** This is a research-grade tool. For operational conjunction screening, use USSTRATCOM Conjunction Data Messages (CDMs).

---

#### Tool 2 — Orbital Decay Predictor

Estimates **when a low-orbit object will re-enter Earth's atmosphere** using the BSTAR drag term from its TLE.

**How to use:**
1. Open `/research` → click **Decay** tab
2. Search for any satellite (most useful for objects below 600 km)
3. Result appears automatically

Output includes:
- Current perigee and apogee altitude
- Predicted re-entry date with ±uncertainty window
- Confidence rating (HIGH / MEDIUM / LOW)
- Altitude decay trail — sparkline chart showing perigee vs apogee over time

**Physics:** Uses a semi-analytical BSTAR numerical integration method. Accuracy is typically ±30% for well-observed objects below 400 km. Solar activity (F10.7 index) is not modelled, which is the primary source of uncertainty.

> **Not suitable for operational re-entry prediction.** For that, use USSTRATCOM reentry assessments or ESA DRAMA.

---

#### Tool 3 — Pass Prediction

Predicts **when a satellite will pass over ISRO ground stations** — giving AOS (Acquisition of Signal) and LOS (Loss of Signal) times.

**How to use:**
1. Open `/research` → click **Passes** tab
2. Search for a satellite
3. Select a specific ISRO station or leave as "All ISRO Stations"
4. Set the prediction window (12h / 24h / 48h / 72h)
5. Click **Predict Passes**

Output per pass:
- AOS time + azimuth
- TCA (Time of Closest Approach = maximum elevation moment)
- LOS time + azimuth
- Max elevation (MEL) — higher = better signal quality
- Pass duration
- Sunlit indicator (satellite visible to naked eye)

**Supported stations:**

| Station ID | Location | Band |
|---|---|---|
| ISTRAC-BLR | Bangalore (Primary) | S, X |
| ISTRAC-LKO | Lucknow | S |
| ISTRAC-MUS | Mauritius | S, X |
| ISTRAC-PBL | Port Blair | S |
| ISTRAC-TVM | Thiruvananthapuram | S, X |

---

## API Reference

All data is accessible via REST API. Useful for researchers building their own tools.

### GET `/api/satellites`

Returns paginated list of all tracked objects with latest TLE.

```
GET /api/satellites?limit=200&page=1
GET /api/satellites?category=PAYLOAD
GET /api/satellites?category=DEBRIS&origin=IND
GET /api/satellites?active=true
GET /api/satellites?search=starlink
```

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `limit` | integer (1–500) | Results per page. Default: 200 |
| `page` | integer | Page number. Default: 1 |
| `category` | string | `PAYLOAD` \| `ROCKET_BODY` \| `DEBRIS` \| `UNKNOWN` |
| `origin` | string | ISO 3-letter country code e.g. `IND`, `USA`, `CHN` |
| `active` | boolean | `true` = active payloads only |
| `search` | string | Case-insensitive name search |

---

### GET `/api/satellite/[norad_id]`

Returns full metadata + live ECI position for a single object.

```
GET /api/satellite/25544
GET /api/satellite/25544?at=2025-01-15T12:00:00Z
GET /api/satellite/25544?trail_minutes=90&trail_step_sec=60
```

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `at` | ISO 8601 | Timestamp to propagate to. Default: now |
| `trail_minutes` | integer (0–200) | Length of orbital trail. Default: 0 |
| `trail_step_sec` | integer (10–300) | Seconds between trail points. Default: 60 |

**Response includes:**
- Full satellite metadata (category, origin, launch date, RCS size)
- ECI position (x, y, z in km) and velocity (vx, vy, vz in km/s)
- Geodetic position (latitude, longitude, altitude)
- Orbital trail array (if requested)

---

### POST `/api/conjunction`

Runs conjunction analysis for a target satellite.

```json
POST /api/conjunction
Content-Type: application/json

{
  "norad_id": 25544,
  "window_days": 3
}
```

---

### GET `/api/decay/[norad_id]`

Returns orbital decay prediction for a single object.

```
GET /api/decay/25544
GET /api/decay/25544?max_days=1825
```

---

### GET `/api/passes/[norad_id]`

Returns pass predictions over ISRO ground stations.

```
GET /api/passes/25544
GET /api/passes/25544?station=ISTRAC-BLR
GET /api/passes/25544?station=ISTRAC-BLR&hours=48
```

---

## Data Sources

| Source | What we use | Update frequency |
|---|---|---|
| [Space-Track.org](https://www.space-track.org) | TLE data for 34,000+ objects | Every 6–12 hours (GitHub Actions cron) |
| [NASA Visible Earth](https://visibleearth.nasa.gov) | Earth texture maps | Static |
| ISRO ISTRAC | Ground station coordinates | Static |

Space-Track.org is operated by the 18th Space Defense Squadron, US Space Command. A free account is required for data access.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser / Client                  │
│  Globe (Three.js / R3F)  │  Research Dashboard      │
│  satellite.js SGP4       │  (Next.js React)         │
└──────────────┬───────────────────────┬──────────────┘
               │ /api/*                │
┌──────────────▼───────────────────────▼──────────────┐
│              Next.js 14 App Router (Edge/Node)       │
│  /api/satellites  /api/conjunction  /api/decay       │
│  /api/satellite/[id]  /api/passes/[id]               │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│           Supabase (PostgreSQL + PostGIS)            │
│                                                      │
│  satellites     → master catalog (34k+ objects)     │
│  tle_history    → TLE snapshots (time-series)        │
│  conjunction_events → computed close approaches      │
│  decay_predictions  → re-entry forecasts             │
│  ground_stations    → ISRO station registry          │
│  sync_logs          → sync audit trail               │
└──────────────────────────▲──────────────────────────┘
                           │ sync every 6h
┌──────────────────────────┴──────────────────────────┐
│     GitHub Actions Cron → scripts/sync-tle.ts        │
│          Space-Track.org REST API                    │
└─────────────────────────────────────────────────────┘
```

**Orbital propagation:** SGP4/SDP4 via [satellite.js](https://github.com/shashwatak/satellite-js) — the standard algorithm used by NORAD for near-Earth objects.

**3D rendering:** [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Three.js](https://threejs.org/). Satellites rendered as `InstancedMesh` — a single GPU draw call for all 34,000 objects, maintaining 60 FPS.

---

## Setup (For Developers)

### Prerequisites

- Node.js 18+
- A free [Space-Track.org](https://www.space-track.org/auth/createAccount) account (approval takes 1–2 days)
- A free [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/your-username/space-drishti.git
cd space-drishti
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Space-Track.org credentials
SPACETRACK_USER=your_email@example.com
SPACETRACK_PASS=your_password

# Supabase (public client)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase (server-only — never expose to browser)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Database setup

Run the schema SQL in your Supabase SQL editor:

```bash
# File: space-drishti-schema.sql
# (included in /docs/schema.sql)
```

Generate TypeScript types from your schema:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > types/database.ts
```

### 4. Download Earth textures

```bash
mkdir -p public/textures && cd public/textures
curl -L "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg"       -o earth_daymap.jpg
curl -L "https://www.solarsystemscope.com/textures/download/2k_earth_normal_map.png"   -o earth_normal.jpg
curl -L "https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.png" -o earth_specular.jpg
curl -L "https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg"       -o earth_clouds.jpg
```

### 5. Initial data sync

```bash
# Fetches 34k+ objects from Space-Track — takes ~2 minutes
npx ts-node scripts/sync-tle.ts
```

### 6. Run

```bash
npm run dev
# Open http://localhost:3000
```

---

## Automated Sync (GitHub Actions)

The TLE data auto-updates via a GitHub Actions workflow. Add these secrets to your repository:

**Settings → Secrets → Actions:**

| Secret | Value |
|---|---|
| `SPACETRACK_USER` | Your Space-Track email |
| `SPACETRACK_PASS` | Your Space-Track password |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |

Create `.github/workflows/sync-tle.yml`:

```yaml
name: Sync TLE Data

on:
  schedule:
    - cron: '0 */6 * * *'   # Every 6 hours
  workflow_dispatch:          # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx ts-node scripts/sync-tle.ts
        env:
          SPACETRACK_USER: ${{ secrets.SPACETRACK_USER }}
          SPACETRACK_PASS: ${{ secrets.SPACETRACK_PASS }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Glossary

| Term | Full form | Meaning |
|---|---|---|
| **TLE** | Two-Line Element set | Standard format for describing a satellite's orbit, published by Space-Track |
| **SGP4** | Simplified General Perturbations 4 | Algorithm that converts TLEs into position/velocity at any time |
| **ECI** | Earth-Centered Inertial | Coordinate frame fixed to the stars, used for orbital mechanics |
| **ECEF** | Earth-Centered Earth-Fixed | Coordinate frame that rotates with Earth |
| **SSA** | Space Situational Awareness | Knowledge of all objects in orbit and their predicted behavior |
| **NORAD ID** | North American Aerospace Defense Command ID | Unique integer assigned to every tracked space object |
| **BSTAR** | Radiation pressure coefficient | Drag term in TLE that governs how quickly an orbit decays |
| **AOS** | Acquisition of Signal | Moment a satellite rises above a ground station's horizon |
| **LOS** | Loss of Signal | Moment a satellite drops below a ground station's horizon |
| **MEL** | Maximum Elevation | Highest point in the sky a satellite reaches during a pass |
| **TCA** | Time of Closest Approach | Moment of minimum separation between two objects (conjunction) or maximum elevation (pass) |
| **Pc** | Probability of Collision | Statistical likelihood of two objects occupying the same space at TCA |
| **CDM** | Conjunction Data Message | Official USSTRATCOM collision warning message |
| **Perigee** | — | Lowest point of an orbit above Earth's surface |
| **Apogee** | — | Highest point of an orbit above Earth's surface |
| **LEO** | Low Earth Orbit | Altitude 160–2000 km — where most active satellites and debris live |
| **GEO** | Geostationary Earth Orbit | Altitude ~35,786 km — communications and weather satellites |

---

## Limitations & Disclaimers

- **Not for operational use.** Conjunction Pc values and decay predictions are research-grade estimates. Do not use for spacecraft operations, re-entry warnings, or collision avoidance without validation.
- **TLE age matters.** Positions become less accurate as TLEs age. Space Drishti syncs every 6 hours; objects with perigee below 400 km may have significant position error if their TLE is >24 hours old.
- **Untracked objects.** The Space Surveillance Network tracks objects >10 cm in LEO. Millions of smaller debris fragments are not in the catalog.
- **Solar activity.** Atmospheric drag (and therefore decay rate) is highly sensitive to solar activity (F10.7 index). This is not modelled in the current decay predictor.

---

## Contributing

Space Drishti is open-source. Contributions welcome — especially:

- Better atmospheric density model (NRLMSISE-00 integration)
- Solar activity (F10.7) correction for decay predictions
- Maneuver detection (TLE delta-v analysis)
- Mobile-responsive 3D view
- ISRO satellite catalog tagging

---

## License

MIT License — free to use, modify, and distribute with attribution.

---

*Built with ❤️ for the Indian space research community.*
*Data courtesy of Space-Track.org (18th Space Defense Squadron, US Space Command)*

<!-- Security scan triggered at 2026-09-05 07:29:17 -->