# RaktJaal — Hyperlocal Blood Donor Matching Platform

A real-time platform that replaces the "WhatsApp-forward-and-pray" routine for finding blood donors with targeted, distance-and-urgency-matched alerts — built as a CS-DS academic mini project at PSIT Kanpur.

**Status: active build. Frontend is in place; backend (Supabase) is being wired in next — see [Roadmap](#-roadmap) below.**

---

## 🩸 What Does It Do?

RaktJaal is built around one problem: urgent blood requests usually get seen too late, not because no one would help, but because the right donor never saw the post. RaktJaal replaces mass-forwarding with a system that posts a request once and pushes it straight to nearby, matching, eligible donors.

**Core idea:**
- A requester posts blood type, units needed, and hospital location
- The system matches donors by blood type and distance (10km radius target)
- Matched donors get notified — no manual sharing, no guesswork
- A donor accepts, and contact details unlock in-app (no public numbers)

---

## ✨ Features

### Landing Page
- **Coverage checker**: Enter a city to check live coverage, with a graceful "not live here yet" fallback
- **Live feed mock**: Requests sorted by distance and urgency, nearest and most time-critical always on top
- **Emergency mode**: Life-critical requests get a red flag and a live countdown timer
- **Scroll-reveal storytelling**: Animated sections explaining how matching, verification, and one-tap accept work
- **Stats strip**: Target alert time, match radius, and the "seen too late" problem stated in numbers

### Authentication
- **Login / Register** flows with shared visual language and route-based mode switching (`/login`, `/register`)
- **Real email validation**: Full-address format check against a real provider allowlist (Gmail, Outlook, Yahoo, iCloud, etc.)
- **Password strength rules**: Live checks for length, uppercase, number, and symbol as the user types
- **Per-account data isolation**: Each email gets its own directory entry — no shared or leaked state between accounts

### Profile
- **Editorial single-column layout**: Sparse, scannable profile after several rejected denser designs
- **Inline field editing**: Name, phone, address — edit-in-place with validation, not modal forms
- **Client-side photo pipeline**: Upload, crop-to-fit, and canvas-compress profile photos under a byte-size cap before storage
- **Pincode → address autofill**: Looks up city/state from a pincode and lets the user confirm before saving
- **Blood type picker**: Dedicated selector tied to donor eligibility
- **Donation history + eligibility**: Tracks past donations and computes the next eligible donation date
- **Security surface**: 2FA setup flow, phone OTP verification, and a type-to-confirm delete-account flow
- **Identity capture**: Separate ID document capture, decoupled from the profile photo

### Data Layer (current)
- **`authStore.js`** is a deliberate placeholder: a small directory keyed by email, backed by `localStorage`, with the logged-in pointer in `sessionStorage`
- Every function (`registerUser`, `loginUser`, `getCurrentUser`, `saveCurrentUser`, `clearCurrentUser`) is written as a drop-in seam — swapping in real Supabase calls means rewriting this one file, not touching `AuthPage.jsx` or `ProfilePage.jsx`

---

## 🛠️ Technology Stack

**Frontend:**
- React 19
- Vite (build tool)
- React Router DOM (client-side routing)
- Tailwind CSS v4
- Lucide React (icons)

**Data (current → planned):**
- `localStorage` / `sessionStorage` placeholder directory → Supabase (auth + Postgres) — not yet wired

**Architecture:**
- Single-page app, three routes: landing (`/`), auth (`/login`, `/register`), profile (`/profile`)
- Each page is currently a large, monolithic single-file component (landing, auth, and profile pages each own their full UI — no shared component library yet)

---

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Setup
```bash
# Clone the repository
git clone https://github.com/thattimelessman/raktjaal.git
cd raktjaal

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will open at `http://localhost:5173`

### Build for production
```bash
npm run build
npm run preview
```

---

## 🎮 Quick Start

1. **Launch the dev server** (`npm run dev`)
2. **Land on the homepage** — check the coverage checker, scroll through how-it-works and the feature mocks
3. **Register a new account** at `/register` — pick a blood type, fill in a real-format email, and a password meeting the strength rules
4. **Land on your profile** at `/profile` — edit fields inline, upload a profile photo, add your address via pincode lookup
5. **Log out and log back in** with the same email — your data persists via the placeholder directory (per-browser, not synced across devices yet)

---

## 📁 Project Structure
```
RaktJaal/
├── src/
│   ├── RaktJaal.jsx        # Landing page — hero, feature grid, how-it-works, FAQ
│   ├── Authpage.jsx         # Login + register forms, validation, routing
│   ├── Profilepage.jsx      # Profile editor — photo, address, security, donation history
│   ├── Authstore.js         # Placeholder auth/data layer (localStorage/sessionStorage)
│   ├── main.jsx              # Router setup — /, /login, /register, /profile
│   ├── index.css
│   └── assets/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── eslint.config.js
├── vite.config.js
├── package.json
└── README.md
```

---

## 🗺️ Roadmap

RaktJaal is being built in stages as part of an ongoing mini project cycle. Near-term:

- [ ] Wire up Supabase (auth + Postgres) behind the existing `authStore.js` seam
- [ ] Real donor-matching logic (blood type + distance radius, not mocked)
- [ ] Live request feed backed by real data instead of static UI mocks
- [ ] Push/SMS notification pipeline for matched donors
- [ ] Deploy a live demo

---

## 🎓 Academic Context

RaktJaal is a mini project for the B.Tech CSE (Data Science) program at PSIT Kanpur, built by a four-person team (**CS-DS-3A-05**).

---

## 📧 Contact

Questions? Ideas? Found a bug?

- **Email**: thattimelessman@gmail.com
- **Instagram**: [@thattimelessman](https://instagram.com/thattimelessman)
- **GitHub Issues**: [Report a bug](https://github.com/thattimelessman/raktjaal/issues)

---

**Made for the people who show up when someone else needs blood.**