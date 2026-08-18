# Glammzo Mobile — Agent / Chat Handoff Context

Paste this into a new Cursor chat when working in **Glammzo-mobile**. Follow it strictly.

---

## Hard constraint

**DO NOT modify, restart, refactor, or depend on changing `Glammzo-web` or `glamzzo-crm` unless the user explicitly asks.**

- Mobile work stays only inside: `/Users/bhaveshbandhiya/Project/Glammzo-Main/Glammzo-mobile`
- Glammzo-web must keep running for the user’s ongoing web work. Do not break or block it.
- Do not add `/api/mobile/*` routes, change auth, or edit web libs until the user says so.
- Until mobile APIs exist, mock data / placeholders in the RN app are fine.

---

## Product goal

Build a **React Native (Expo) consumer app** that mirrors **Glammzo-web mobile UI**:

- Same 3-tab shell (Home=`/explore`, Bookings, Profile)
- Same flows: explore → salon cart → book → confirmation; OTP login; profile hub
- Same backend rules later via APIs — not duplicated in the app
- Luxurious / minimal / modern styling matching web brand (coral / sand / cream, Logo wordmark, Inter/Sora/Bricolage)

---

## Architecture (agreed)

| Layer | Role |
| --- | --- |
| **Glammzo-mobile (Expo)** | UI only + token storage + API client |
| **Glammzo-web (Next.js)** | Future BFF: JSON `/api/mobile/*` wrapping existing `src/lib/*` |
| **Supabase** | Shared data (CRM tables). **Never** put service-role keys in the mobile app |
| **glamzzo-crm** | Partner CRM / WhatsApp Meta sends — not called directly from RN |

### Auth (wired for staging)

- Mobile: phone OTP → Bearer JWT in **Expo SecureStore** (`auth-api.ts`, `login.tsx`, `session.ts`)
- Staging OTP: `SMS_FIXED_OTP` / `debugOtp` on Glammzo-web; production SMS deferred
- Login links to public **Terms** / **Privacy** on glammzo.com

---

## Current mobile project status (done)

Expo SDK **54** + TypeScript + Expo Router.

### Location

`/Users/bhaveshbandhiya/Project/Glammzo-Main/Glammzo-mobile`

### Already set up

- **3 tabs:** Home (`explore`) / Bookings / Profile — matches web mobile tab bar
- **Stack:** `salon/[id]`, `book/[salonId]`, `book/confirmation`, `login`, `services`, `review`, `bookings/[id]/reschedule`, `profile/{wallet,loyalty,activity,details,favorites}`
- Brand: tokens, Inter/Sora/Bricolage, Logo wordmark, `assets/brand/`
- Chrome: TopChrome, BottomSheet, StickyCta, SalonCard (+ favorite heart), BusinessTypeStrip, MapOverlay
- Cart + Favorites contexts (in-memory)
- **Catalog:** `GET /api/salons` via `salons-api.ts` (60s cache). Mock fallback **`__DEV__` only** — production builds return empty on failure
- **Phase 2 core:** Bearer `/api/mobile/*` (auth OTP, me, profile, wallet, loyalty, bookings CRUD)
- Legal URLs in `src/lib/legal.ts` + `app.config.js` `extra.legal`; `ios.buildNumber: "1"`

### Run

```bash
cd /Users/bhaveshbandhiya/Project/Glammzo-Main/Glammzo-mobile
npm start
```

Physical device: set LAN IP in `.env` (staging web only — never production until you ship):

`EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4008`

Glammzo-web must use **staging** Supabase (`.env.development`, host `ixsrimysgjizxfdwaxdx…`).

---

## Phase 2 gaps (later)

| Flow | Why |
| --- | --- |
| Production API URL | Wire at the end (HTTPS) |
| Production SMS | Staging fixed OTP only for now |
| Reviews create | Still mock UI |
| Favorites sync | In-memory |
| Promo / slots APIs | Client-side for now |
| Cart persistence | AsyncStorage not wired yet |

Done: Bearer OTP, me, profile, wallet/loyalty reads, bookings CRUD, legal links, no prod mock catalog.

---

## Next steps (in this mobile repo only)

1. High-priority launch gaps: cart persist, favorites, reviews, slots/promos, profile money UI
2. Preview builds for push QA
3. Wire production API URL + OTP SMS when ready to ship

---

## Working rules for the agent

1. Only edit files under `Glammzo-mobile` unless user explicitly allows web/CRM changes.
2. Prefer Expo + Expo Router conventions.
3. Keep `apiFetch` / SecureStore as the integration point for future APIs.
4. Do not invent a second booking engine in the app.
5. Communicate briefly; ship incremental runnable UI.
6. If a task seems to require Glammzo-web changes, **stop and ask** instead of editing web.

---

## One-line summary

**Glammzo-mobile is the Expo twin of Glammzo-web’s mobile UI. Staging Bearer auth/bookings are wired; production API/SMS deferred. Legal links + no fake catalog in prod builds are in place.**
