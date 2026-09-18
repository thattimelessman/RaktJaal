# RaktJaal

From social media chaos to 30-second donor matches.

This repo implements **Phase 1 (Core flow)** end-to-end, using **email/password
and Google sign-in** for donor authentication, and is scaffolded so Phases
2–5 are focused additions rather than rewrites.

## What's built (Phase 1)

- **Auth** — `/login` and `/signup`: email/password (Firebase Auth) plus a
  "Continue with Google" button (`signInWithPopup`). Either path lands the
  user with a Firebase Auth `uid`, which is what donor documents are keyed
  by in Firestore.
- **Requester form** — `/request`: blood type, units, hospital, location
  (browser geolocation or manual lat/lng), urgency, contact number. No
  login required to post a request — matches the "no login friction"
  hospital-view goal from the demo script.
- **Donor signup** — `/donor/signup`: requires sign-in (redirects to
  `/login?redirect=/donor/signup` if not authenticated), then collects
  name, phone, blood type, and location, and writes to
  `donors/{uid}`.
- **Static matching** — on submit, the requester is routed to
  `/request/[id]`, which runs a one-shot Firestore query for donors of the
  matching blood type within a geohash box around the request, filters to
  a true 10km radius (haversine), and sorts nearest-first.
- **Privacy-first by default**: donor phone numbers are never rendered in
  the match list, even though Phase 1's Firestore rules don't yet enforce
  that server-side — see the "Security" note below.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Auth | Firebase Auth — email/password + Google sign-in |
| Backend/DB | Firebase Firestore |
| Geo matching | `ngeohash` + haversine distance, client-side query |

## Getting started

```bash
npm install
cp .env.local.example .env.local
```

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (start in production mode) and paste the
   rules from `firestore.rules` into the Rules tab.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Authentication → Sign-in method → Google**, and set a support
   email when prompted.
5. In Project settings → General → "Your apps", add a Web app and copy the
   config values into `.env.local`.
6. The Google sign-in popup requires `localhost` (dev) and your real
   domain (prod) to be listed in **Authentication → Settings → Authorized
   domains**. `localhost` is usually pre-authorized.

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Auth model

- Donor documents live at `donors/{uid}`, where `uid` is the Firebase Auth
  user id — the same value whether the person signed up with email/password
  or Google. `authProvider` on the donor doc records which one was used
  (`password` or `google.com`), purely for your own analytics; it doesn't
  affect matching.
- A user can sign in with Google today and, if they forget, later try
  "sign up" with the same email/password — Firebase will throw
  `auth/account-exists-with-different-credential` in that case, which the
  app surfaces as a friendly error rather than silently failing.
- Password reset is wired up via `sendPasswordResetEmail` from the login
  page's "Forgot password?" link.

## Security note

The included `firestore.rules` are intentionally permissive for Phase 1
(no hospital accounts yet, per the "no login friction" flow in the demo
script). Donor documents are readable by anyone so the match query can
run client-side — the app UI simply never displays the `phone` field
outside of the donor's own session. Before a public launch, move `phone`
into a subcollection or a Cloud Function-mediated reveal so it's enforced
at the database layer too, not just hidden in the UI.

## Roadmap 

**Phase 2 — Real-time**
- Swap `getDocs` in `src/lib/matching.ts` for `onSnapshot` so the donor
  list updates live, sorted by distance/urgency.
- Add a "❤️ I can help" button on `DonorCard` that reveals the
  requester's contact info only after the donor taps it (and vice versa
  — reveal the donor's phone to the requester at that point via a
  Cloud Function, per the security note above).

**Phase 3 — PWA layer**
- `npm install next-pwa`, uncomment the wrapper in `next.config.js`.
- Add `public/manifest.json` + icons, enable "Add to Home Screen".
- Cache last-seen requests and the donor's own profile for offline view.

**Phase 4 — Notifications**
- Firebase Cloud Messaging (`firebase/messaging`) for web push, using
  `NEXT_PUBLIC_FCM_VAPID_KEY`.
- A server-side route (`src/app/api/notify/route.ts`) using the Twilio
  Node SDK to send SMS/WhatsApp fallback to donors without the PWA
  installed — env vars are already stubbed in `.env.local.example`.

**Phase 5 — India-specific polish**
- `next-intl` (or similar) for Hindi/English toggle.
- Donor badges, ratings, and post-donation health tips as new Firestore
  collections (`badges`, `reviews`) plus UI on the donor profile.
- Low-bandwidth mode: lazy-load the Google Maps JS API only when a map
  view is opened, and keep payloads (e.g. donor list fields) minimal.

## Project structure

```
src/
  app/
    page.tsx                  Landing page
    login/page.tsx            Email/password + Google sign-in
    signup/page.tsx           Email/password + Google sign-up
    request/page.tsx          Requester form
    request/[id]/page.tsx     Match results for a submitted request
    donor/signup/page.tsx     Donor profile form (auth required)
    layout.tsx                Root layout, wraps app in AuthProvider
    globals.css               Tailwind base + shared utility classes
  components/
    NavBar.tsx                Header showing signed-in state
    GoogleButton.tsx           "Continue with Google" button
    DonorCard.tsx              Donor match result card
  hooks/
    useAuth.tsx                Auth context (current Firebase user)
    useGeolocation.ts          Browser Geolocation API wrapper
  lib/
    firebase.ts                Firebase app/Firestore/Auth init
    auth.ts                    Email/password + Google auth helpers
    geohash.ts                 Geohash encode + search-cell + haversine
    matching.ts                 Phase 1 static donor query
  types/index.ts                Shared types (Donor, BloodRequest, ...)
```
