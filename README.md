# RaktJaal — From social media chaos to 30-second donor matches

Blood requests in India still mostly happen the way they always have: someone
posts a frantic message on a WhatsApp group or Instagram story, it gets
forwarded a dozen times, and by the time it reaches an actual compatible
donor nearby, the window has often closed. RaktJaal replaces that chain with
a direct, location-aware match: post a request or register as a donor, and
the app finds compatible people within a real radius in seconds — no group
forwarding, no login friction for the person who's actually in a hospital.

This repo implements **Phase 1 (core flow)** end-to-end — email/password
(with mandatory email-OTP verification) and Google sign-in, a real
Firestore-backed donor directory, and geohash-based proximity matching —
scaffolded so Phases 2–5 (below) are additions, not rewrites.

---

## 🩸 What's Built — Phase 1 (Core Flow)

- **Auth** — `/login` and `/register` (both routed through the shared
  `legacy/AuthPage.jsx`): email/password (Firebase Auth) plus a "Continue
  with Google" button (`signInWithPopup`). New email/password accounts must
  verify a 6-digit email OTP before they can sign in — see
  [Email verification & account deletion](#-email-verification--account-deletion)
  below. Either path lands the user with a Firebase Auth `uid`, which is what
  donor and user documents are keyed by in Firestore.
- **Requester form** — `/request`: blood type, units, hospital, location
  (browser geolocation or manual lat/lng), urgency, and a contact number.
  No login required to post a request — matches the "no login friction"
  hospital-view goal.
- **Donor signup** — `/donor/signup`: requires sign-in (redirects to
  `/login?redirect=/donor/signup` if not authenticated), then collects
  name, phone, blood type, and location, and writes to `donors/{uid}`.
- **Static matching** — on submit, the requester is routed to
  `/request/[id]`, which runs a one-shot Firestore query for donors of the
  matching blood type within a geohash box around the request, filters to
  a true 10km radius (haversine), and sorts nearest-first.
- **Privacy-first by default**: donor phone numbers are never rendered in
  the match list, even though Phase 1's Firestore rules don't yet enforce
  that server-side — see [Security note](#-security-note).

---

## ✨ Features

### Authentication
- Email/password **and** Google sign-in (`signInWithPopup`), both landing
  the user with the same kind of Firebase Auth `uid`.
- **Mandatory email verification**: a new email/password account can't sign
  in until it verifies a 6-digit OTP sent to its own inbox. Signing in with
  an unverified account automatically re-sends the OTP and signs the session
  back out with a clear message, instead of leaving it half-authenticated.
- Friendly, mapped error messages for the Firebase Auth codes that actually
  come up in practice — wrong password, popup closed, account-exists-with-
  different-credential, weak password, too many attempts, etc.
- Password reset via `sendPasswordResetEmail`.
- Account deletion is itself OTP-gated (see below), with the underlying
  Firebase user and Firestore profile removed together via a server route.

### Email verification & account deletion
- OTP codes are generated and checked **server-side**: `POST /api/email-otp/send`
  and `POST /api/email-otp/verify` (used for registration), and
  `POST /api/account/delete` (used for account deletion), all authenticated
  with a Firebase ID token and backed by the Firebase Admin SDK.
- Codes are 6 digits, SHA-256 hashed before being stored in an `emailOtps`
  Firestore collection (never stored in plaintext), expire after 10 minutes,
  allow at most 5 incorrect attempts, and enforce a 60-second resend
  cooldown — all server-enforced in `backend/lib/emailOtp.ts`.
- Email delivery goes through **Gmail SMTP via Nodemailer** — see
  [Email OTP setup](#-email-otp-setup) below for the exact environment
  variables required.

### Donor matching
- **Geohash-indexed search**: donors are written with a precision-6 geohash;
  a request query fans out across the center cell and its 8 neighbors so a
  donor just across a cell boundary isn't missed.
- **True-radius filtering**: every candidate is re-checked with a haversine
  distance calculation against a 10km cap, then sorted nearest-first.
- One-shot (`getDocs`) for now — Phase 2 swaps this for `onSnapshot` to make
  the match list live.

### Account / profile
- A real `users/{uid}` Firestore profile (name, DOB, address, blood type,
  phone, secondary emails, profile photo) — separate from the `donors`
  collection, which exists purely for geo-matching and needs phone + lat/lng.
- Profile photo upload with client-side compression: every photo is
  re-encoded as JPEG and squeezed under 400KB before it's stored.
- Inline profile editing, session/device info, and account deletion, all
  wired to the real Firebase Auth + Firestore profile — not local state.

### Product surface (UI-complete, partly mocked)
- A full marketing landing page, redesigned auth screens, and an
  **ActionPage** — the two-tab "Need Blood" / "Donate Blood" screen a
  signed-in person lands on after login.
- ActionPage's sign-in state, profile data, and avatar are real (Firebase
  Auth + the same `users/{uid}` doc ProfilePage reads). The nearby-donor
  list, the map panel, notifications, and the inbox are intentionally
  **mock UI** for now — clearly marked `MOCK_` in the source — since wiring
  them needs schemas (a live directory query, a messaging collection) that
  don't exist yet. Nothing here sends a real push, SMS, or call.

---

## 🛠️ Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript/JSX + Tailwind |
| Auth | Firebase Auth — email/password + Google sign-in |
| Database | Firebase Firestore |
| Server / API routes | Next.js Route Handlers + Firebase Admin SDK (`firebase-admin`) |
| Email delivery | Nodemailer over Gmail SMTP (OTP codes) |
| Geo matching | `ngeohash` (precision-6 geohash) + haversine distance, client-side query |
| Icons | lucide-react |

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Firebase project
- A Google account with an [App Password](https://myaccount.google.com/apppasswords)
  for sending OTP emails via Gmail SMTP (see [Email OTP setup](#-email-otp-setup))

### Setup

```bash
git clone https://github.com/thattimelessman/RaktJaal.git
cd RaktJaal
npm install
cp .env.example .env.local
```

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore Database** (start in production mode) and paste the
   rules from `firestore.rules` into the Rules tab.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Authentication → Sign-in method → Google**, and set a support
   email when prompted.
5. In Project settings → General → "Your apps", add a Web app and copy the
   config values into `.env.local`.
6. The Google sign-in popup requires `localhost` (dev) and your real domain
   (prod) to be listed in **Authentication → Settings → Authorized domains**.
   `localhost` is usually pre-authorized.
7. Generate a Firebase Admin service account (Project settings → Service
   accounts → Generate new private key) and fill in the
   `FIREBASE_ADMIN_*` variables in `.env.local` — the OTP and account-deletion
   API routes need this to verify ID tokens and write to Firestore as an
   admin.
8. Set up Gmail SMTP credentials for OTP delivery — see
   [Email OTP setup](#-email-otp-setup) below.

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## 📁 Project Structure

```
RaktJaal/
├── src/
│   ├── app/                          Next.js App Router pages
│   │   ├── page.jsx                  Landing page
│   │   ├── login/page.jsx            → legacy/AuthPage (login mode)
│   │   ├── register/page.jsx         → legacy/AuthPage (register mode)
│   │   ├── signup/page.jsx           Redirect shim: old /signup → /register
│   │   ├── action/page.jsx           Post-login "Need Blood" / "Donate Blood" screen
│   │   ├── profile/page.jsx          Account settings — profile, security, delete account
│   │   ├── request/page.tsx          Requester form (no login required)
│   │   ├── request/[id]/page.tsx     Match results for a submitted request
│   │   ├── donor/signup/page.tsx     Donor profile form (auth required)
│   │   ├── api/email-otp/send/route.ts    Generates + emails a 6-digit OTP
│   │   ├── api/email-otp/verify/route.ts  Verifies an OTP (registration or deletion)
│   │   ├── api/account/delete/route.ts    OTP-gated account + profile deletion
│   │   ├── layout.tsx                Root layout — wraps app in AuthProvider + SiteChrome
│   │   └── globals.css               Tailwind base + shared utility classes
│   ├── frontend/
│   │   ├── components/
│   │   │   ├── SiteChrome.tsx        Full-bleed vs. shared-nav layout switch per route
│   │   │   ├── NavBar.tsx            Header for shared-chrome routes
│   │   │   ├── GoogleButton.tsx      "Continue with Google" button
│   │   │   ├── DonorCard.tsx         Donor match result card
│   │   │   └── legacy/AuthPage.jsx   Shared login/register screen + OTP verification UI
│   │   └── hooks/
│   │       ├── useAuth.tsx           Auth context (current Firebase user)
│   │       └── useGeolocation.ts     Browser Geolocation API wrapper
│   └── backend/
│       ├── lib/
│       │   ├── firebase.ts           Firebase client app/Firestore/Auth init
│       │   ├── firebaseAdmin.ts      Firebase Admin SDK init (server-only)
│       │   ├── auth.ts               Email/password + Google auth helpers, OTP client calls, friendly errors
│       │   ├── emailOtp.ts           Server-side OTP generation, hashing, and verification
│       │   ├── userProfile.ts        users/{uid} profile CRUD (Firestore)
│       │   ├── matching.ts           Geohash + haversine donor matching query
│       │   └── geohash.ts            Geohash encode, search-cell neighbors, haversine distance
│       └── types/index.ts            Shared types (Donor, BloodRequest, DonorMatch, ...)
├── firestore.rules                   Security rules for donors/, users/, requests/
└── .env.example                      Firebase + SMTP config template
```

---

## 🔐 Auth model

- Donor documents live at `donors/{uid}`, where `uid` is the Firebase Auth
  user id — the same value whether the person signed up with email/password
  or Google. `authProvider` on the donor doc records which one was used
  (`password` or `google.com`) for analytics only; it doesn't affect
  matching.
- Email/password accounts must verify a 6-digit OTP (sent to their own
  inbox) before they can sign in. `signInWithEmail` checks
  `cred.user.emailVerified`, and if it's `false`, it fires off a fresh OTP,
  signs the session back out, and surfaces a "verify your email" message
  rather than letting an unverified session through.
- If someone signs in with Google and later tries to sign up with the same
  email/password, Firebase throws `auth/account-exists-with-different-credential`,
  which the app surfaces as a friendly error instead of failing silently.
- `ensureUserProfile` backfills a `users/{uid}` profile doc on first Google
  sign-in without clobbering any existing data.
- Account deletion also requires a fresh OTP: `/api/account/delete` verifies
  the code server-side, then deletes the `users/{uid}` Firestore doc and the
  Firebase Auth user in the same request.

---

## 🔒 Security Note

The included `firestore.rules` are intentionally permissive for Phase 1 (no
hospital accounts yet, matching the "no login friction" hospital-view goal):

- Donor documents are **readable by anyone** so the match query can run
  client-side — the app UI simply never displays the `phone` field outside
  the donor's own session.
- Blood requests are open-read/open-create with no auth gate.
- The `emailOtps` collection has no client-facing Firestore rule because it's
  only ever touched by the Admin SDK from the API routes — OTP hashes are
  never exposed to, or writable by, the browser.

Before a public launch, move `phone` into a subcollection or a Cloud
Function–mediated reveal so this is enforced at the database layer, not just
hidden in the UI.

---

## 📧 Email OTP setup

Account registration and account deletion both require a real 6-digit email
OTP. Codes are generated, hashed, and checked server-side in
`backend/lib/emailOtp.ts`; the Firebase Admin SDK verifies the signed-in
user before an OTP is issued or checked. Delivery is handled by
**Nodemailer over Gmail SMTP**.

Add these server-only variables to `.env.local`:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `SMTP_USER` — the Gmail address OTP emails are sent from
- `SMTP_PASSWORD` — a Gmail [App Password](https://myaccount.google.com/apppasswords)
  (not your regular account password — Gmail requires 2-Step Verification
  to be enabled first)
- `SMTP_HOST` — optional, defaults to `smtp.gmail.com`
- `SMTP_PORT` — optional, defaults to `465`

Do not prefix these server secrets with `NEXT_PUBLIC_`. The
`FIREBASE_ADMIN_PRIVATE_KEY` value may contain `\n` line breaks.

Install the added server dependencies with `npm install`, then run
`npm run dev`.

---

## 🗺️ Roadmap

**Phase 1 — Core flow**
- Email/password + Google auth (with OTP-verified email), requester form,
  donor signup, and static geohash + haversine matching — see
  [What's Built](#-whats-built--phase-1-core-flow) above for the full
  breakdown.

**Phase 2 — Real-time**
- Swap `getDocs` in `matching.ts` for `onSnapshot` so the donor list updates
  live, sorted by distance/urgency.
- Add an "I can help" action on `DonorCard` that reveals contact info only
  after a donor opts in, mediated by a Cloud Function per the security note
  above.

**Phase 3 — PWA layer**
- `next-pwa`, a manifest + icons, "Add to Home Screen".
- Cache last-seen requests and the donor's own profile for offline view.

**Phase 4 — Notifications**
- Firebase Cloud Messaging for web push.
- A server route using the Twilio Node SDK for SMS/WhatsApp fallback to
  donors without the PWA installed.

**Phase 5 — India-specific polish**
- Hindi/English toggle (`next-intl` or similar).
- Donor badges, ratings, and post-donation health tips.
- Low-bandwidth mode: lazy-load any map SDK, keep donor-list payloads minimal.

**Wiring ActionPage's mock surface to something real** (not yet scheduled to
a phase): a real nearby-users query (`matchDonors` in `backend/lib/matching`
is the starting point), an actual maps SDK for the map panel, a Firestore
collection for notification dispatch, and one for inbox messaging.

---

## 👥 Team

Built at **PSIT Kanpur, Dept. of Data Science** as a mini project
(2026–27) — Team CS-DS-3A-05.

---

## 📧 Contact

- **GitHub**: [@thattimelessman](https://github.com/thattimelessman)
- **Instagram**: [@thattimelessman](https://instagram.com/thattimelessman)
- **GitHub Issues**: [Report a bug](https://github.com/thattimelessman/RaktJaal/issues)
- **Live demo**: [raktjaal.vercel.app](https://raktjaal.vercel.app/)