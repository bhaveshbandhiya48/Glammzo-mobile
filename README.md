# Glammzo Mobile

Expo (React Native) app for Glammzo. Mirrors the consumer web experience and will talk to Glammzo-web APIs.

## Prerequisites

- Node 20+
- Expo Go on your phone, or iOS Simulator / Android Emulator
- Glammzo-web running on port 4008 for later API work

## Setup

```bash
cd Glammzo-mobile
npm install
cp .env.example .env
```

Edit `.env` if needed:

- Simulator / emulator: `EXPO_PUBLIC_API_URL=http://localhost:4008`
- Physical device: `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4008`

## Run

```bash
npm start
```

Then press `i` (iOS), `a` (Android), or scan the QR code with Expo Go.

## Project layout

```
app/                 Expo Router screens
  (tabs)/            Home (explore), Bookings, Profile
src/lib/
  api.ts             Fetch helper (Bearer token ready)
  config.ts          API base URL (+ staging guard)
  env.ts             Warns if API_URL looks like production
  salons-api.ts      GET /api/salons → mobile Salon (cache + mock fallback)
  session.ts         SecureStore token helpers
```

## Phase 1–2 (staging)

- Catalog: live `GET /api/salons` (mock fallback)
- Auth / bookings / profile / wallet / loyalty: Bearer `GET|POST /api/mobile/*` on Glammzo-web

Staging web OTP: set `SMS_FIXED_OTP=123456` (and optionally `SMS_DEBUG_OTP=true`) so Expo shows/accepts the fixed code. Do not point mobile at production SMS.

## Next

1. Start Glammzo-web with staging env; point mobile `.env` at LAN origin
2. Login with fixed OTP → create booking → confirm it appears in CRM / Bookings tab
