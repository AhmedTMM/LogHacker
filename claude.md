# Aviation Intelligence - Project Context

## Overview
Flight safety and compliance platform for General Aviation. Parses logbooks via Reducto AI, runs FAA compliance audits, and provides probabilistic risk analysis.

## Tech Stack
- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS, Lucide-React icons
- **Database**: MongoDB via Mongoose
- **State**: TanStack Query
- **APIs**: Reducto AI (document parsing), aviationweather.gov (METAR), Resend (emails)

## Pages

### Home (`/`)
Simple stats dashboard: fleet size, pilot count, upcoming flights, quick actions, recent flights.

### Aircraft (`/aircraft`)
- Aircraft cards with image thumbnails
- **Logbook tab**: Upload maintenance PDF → Reducto parses entries
- **Details tab**: Hobbs/Tach times, maintenance status (annual/transponder/100-hr)
- **Component risk indicators**: Alternator, vacuum pump, magnetos, engine failure probability

### Pilots (`/pilots`)
- **Overview tab**: Hours (total/PIC/night/IFR), safety gap analysis (expired medical, low night hours)
- **Logbook tab**: Upload pilot logbook → parse flight entries via Reducto
- **Safety tab**: NTSB database search for accident history

### Flights (`/flights`)
- Weather lookup widget (METAR display)
- Flight list with status badges (GO/CAUTION/NO-GO)
- **Risk Scenarios**: Probabilistic analysis combining:
  - Electrical failure + night flight + student pilot = CRITICAL
  - Weather deterioration + VFR-only pilot = HIGH
  - Engine failure based on TBO position
- Pilot/Aircraft assessment cards
- FAA compliance checks from legalityService

## Key Services

### `lib/services/reductoService.ts`
Parses logbooks via Reducto AI. Detailed JSON schema prompt for structured extraction.

### `lib/services/legalityService.ts`
FAA compliance engine:
- Aircraft: Annual (12mo), Transponder (24mo), Static (IFR), 100-Hour
- Pilot: Medical, Flight Review (BFR)
- Weather: IFR conditions vs ratings, wind analysis

## Environment Variables
```
MONGODB_URI=mongodb://localhost:27017/aviation-intelligence
REDUCTO_API_KEY=your_key
RESEND_API_KEY=your_key
```