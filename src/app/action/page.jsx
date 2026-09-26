"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/frontend/hooks/useAuth";
import LocationMap from "@/frontend/components/LocationMap";
import { getUserProfile } from "@/backend/lib/userProfile";
import { useRequestsBackend } from "@/frontend/hooks/useRequestsBackend";
import {
  createDonationRequest,
  findNearbyDonors,
  getContactPhone,
  subscribeMessages,
  timeAgo,
  MAX_INLINE_ATTACHMENT_BYTES,
} from "@/backend/lib/requests";
import {
  Droplet,
  MapPin,
  Bell,
  MessageCircle,
  Send,
  ArrowLeft,
  Check,
  X,
  Clock,
  ChevronRight,
  ShieldCheck,
  Inbox as InboxIcon,
  Navigation,
  HeartHandshake,
  Phone,
  Copy,
  Camera,
  Paperclip,
} from "lucide-react";

/* -----------------------------------------------------------------
   ActionPage.jsx — the screen a person lands on right after login.
   Two tabs: "Need Blood" (find a nearby donor and request) and
   "Donate Blood" (see nearby requests and approve/decline them).
   The very first thing a signed-in person sees is a minimal picker —
   nothing else is rendered until they choose a direction.

   BACKEND STATUS (all real, Firestore-backed, live via onSnapshot):
   - Identity: Firebase Auth (useAuth) + users/{uid} profile.
   - Donors: every user with a complete profile is published to
     donors/{uid} (public card, no phone) and donors_private/{uid}
     (phone, released only after approval). See syncDonorFromProfile.
   - "Need Blood": findNearbyDonors() queries real donors by blood type
     + geohash + radius. Requesting creates requests/{me}_{donor}.
   - "Donate Blood": subscribes to requests addressed to me. Approve /
     decline updates the request; approve also opens the chat thread and
     notifies the requester. Another account sees this instantly.
   - Notifications + Inbox: notifications/{id} and threads/{id}/messages.
   - The map uses OpenStreetMap + Leaflet (browser geolocation + search).
   All of it lives in @/backend/lib/requests and is wired through the
   useRequestsBackend hook. Rules are in firestore.rules.
-------------------------------------------------------------------- */

const C = {
  ink: "#111111",
  sub: "#71717A",
  faint: "#A1A1AA",
  paper: "#FFFFFF",
  sidebar: "#FAFAFA",
  border: "#E7E5E4",
  chip: "#F4F4F5",
  hover: "#F4F4F5",
  brick: "#D6303F",
  brickDark: "#B21F2D",
  brickTint: "#FBEAEA",
  blush: "#FDE2E4",
  mint: "#DEF5E4",
  forest: "#1F6B3A",
  sky: "#DCEEFF",
  skyDark: "#1D4ED8",
};
const F = "'Manrope', 'system-ui', sans-serif";
const FD = "'Plus Jakarta Sans', sans-serif";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
@keyframes pulseDot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scaleUp { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes tipIn { from { opacity: 0; transform: translate(-50%, 2px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes bellRing {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  10% { transform: translateX(-1.5px) rotate(-9deg); }
  20% { transform: translateX(1.5px) rotate(9deg); }
  30% { transform: translateX(-1.5px) rotate(-8deg); }
  40% { transform: translateX(1.5px) rotate(8deg); }
  50% { transform: translateX(-1px) rotate(-5deg); }
  60% { transform: translateX(1px) rotate(5deg); }
  70% { transform: translateX(-0.5px) rotate(-3deg); }
  80% { transform: translateX(0.5px) rotate(3deg); }
  90% { transform: translateX(0) rotate(-1deg); }
}
@keyframes toastInOut { 0% { opacity: 0; transform: translateY(-6px) scale(0.98); } 8% { opacity: 1; transform: translateY(0) scale(1); } 88% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-4px) scale(0.98); } }
@keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes dash { to { stroke-dashoffset: 0; } }
.rk-scroll { scrollbar-width: thin; scrollbar-color: #D4D4D8 transparent; }
.rk-scroll::-webkit-scrollbar { width: 7px; }
.rk-scroll::-webkit-scrollbar-track { background: transparent; }
.rk-scroll::-webkit-scrollbar-thumb { background: #D4D4D8; border-radius: 999px; }
/* Native <button> resets to cursor:default under Tailwind's preflight —
   this restores the hand cursor everywhere a button is clickable, the
   same feedback the profile avatar already gives via its inline style. */
button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
button:disabled { cursor: not-allowed; }
.rk-avatar-btn { cursor: pointer !important; }
.rk-avatar-btn:hover { box-shadow: 0 4px 14px -4px rgba(0,0,0,0.28); }
`;

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/* ---------------------------------------------------------------
   Profile-completeness gate (mirrors ProfilePage.jsx's own
   REQUIRED_FIELDS / missingFields exactly, so "complete" means the
   same thing on both screens). Duplicated locally rather than
   imported to keep the two pages independently deployable.
------------------------------------------------------------------ */
const REQUIRED_PROFILE_FIELDS = [
  { key: "name", label: "Full name" },
  { key: "dob", label: "Date of birth" },
  { key: "phone", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "bloodType", label: "Blood type" },
];

function addressIsComplete(addr) {
  if (!addr || typeof addr !== "object") return false;
  return Boolean(
    (addr.street || "").trim() &&
    (addr.city || "").trim() &&
    (addr.state || "").trim() &&
    (addr.pincode || "").trim()
  );
}

function getMissingProfileFields(user) {
  if (!user) return REQUIRED_PROFILE_FIELDS;
  return REQUIRED_PROFILE_FIELDS.filter((f) => {
    if (f.key === "address") return !addressIsComplete(user.address);
    return !user[f.key] || String(user[f.key]).trim() === "";
  });
}

/* Great-circle distance in km, used to show real distances on incoming requests. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------------------------------------------------------------
   Brand mark — the actual RaktJaal mark (a blood-drop silhouette
   with a plus/cross cut out of it), lifted from the marketing site
   (RaktJaal.jsx's BrandMark) so the logo is identical everywhere
   instead of standing in with a generic lucide Droplet icon.
------------------------------------------------------------------ */
function BrandMark({ size = 32 }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40">
        <path
          d="M20 3 C28 15 34 24 34 30 C34 36 27.7 40 20 40 C12.3 40 6 36 6 30 C6 24 12 15 20 3 Z"
          fill={C.brick}
        />
        <rect x="17" y="18" width="6" height="16" rx="1.5" fill="#fff" />
        <rect x="12" y="23" width="16" height="6" rx="1.5" fill="#fff" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------
   Hand-drawn "back" sketch arrow — same mark used under the RaktJaal
   wordmark on AuthPage's "go back to home page" link, reused here to
   step back one window (e.g. donate/need -> the mode picker) instead
   of navigating to a different page.
------------------------------------------------------------------ */
function BackArrow({ label, onClick }) {
  return (
    <button onClick={onClick} className="relative group mt-0.5 ml-2" aria-label={label} style={{ cursor: "pointer" }}>
      <svg width="120" height="24" viewBox="0 0 120 24" fill="none" className="overflow-visible">
        <path
          d="M 16 10 L 6 16 L 16 22 M 6 16 Q 50 10 110 14"
          stroke={C.brick}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: 200, strokeDashoffset: 200, animation: "dash 1.5s ease-out forwards 0.5s" }}
        />
      </svg>
      <div
        className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[11px] px-2.5 py-1.5 rounded shadow-sm border pointer-events-none whitespace-nowrap z-20"
        style={{ color: C.ink, fontFamily: F, borderColor: `${C.ink}22` }}
      >
        {label}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------
   Small shared pieces (same visual language as Profilepage.jsx)
------------------------------------------------------------------ */
function Pill({ children, tone = "default" }) {
  const tones = {
    default: { bg: C.chip, color: C.sub },
    brick: { bg: C.brick, color: "#fff" },
    urgent: { bg: C.blush, color: C.brickDark },
    mint: { bg: C.mint, color: "#1F6B3A" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11.5px] font-semibold shrink-0" style={{ background: t.bg, color: t.color, fontFamily: F }}>
      {children}
    </span>
  );
}

/* Minimal hover tooltip — used on the verified badge so people know
   what the checkmark means without adding permanent label text to
   every donor card. Keyboard users still get it via title fallback
   on the wrapped element. */
function Tooltip({ label, children, side = "top" }) {
  const [show, setShow] = useState(false);
  const posStyle =
    side === "top"
      ? { bottom: "100%", marginBottom: 6 }
      : { top: "100%", marginTop: 6 };

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      {children}
      {show && (
        <span
          className="absolute left-1/2 z-30 whitespace-nowrap px-2 py-1 rounded-md text-[10.5px] font-semibold text-white pointer-events-none"
          style={{ ...posStyle, background: C.ink, fontFamily: F, animation: "tipIn 0.12s ease-out", transform: "translateX(-50%)" }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* Circular avatar — shows the real stored profile photo when one is
   passed in (the signed-in user's own picture), otherwise falls back
   to initials. Mirrors Profilepage.jsx's Avatar so the same photo
   shows up consistently across the app, including tap-to-expand. */
function Avatar({ photo, initials, size = 40, tone = C.chip, expandable = true }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className="rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-opacity hover:opacity-85"
        style={{ width: size, height: size, background: tone, cursor: photo && expandable ? "pointer" : "inherit" }}
        onClick={(e) => {
          if (photo && expandable) {
            e.preventDefault();
            e.stopPropagation(); // Stops the click from triggering parent buttons
            setExpanded(true);
          }
        }}
      >
        {photo ? (
          <img src={photo} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold" style={{ color: C.ink, fontFamily: F, fontSize: Math.round(size * 0.36) }}>
            {initials}
          </span>
        )}
      </div>

      {expanded && photo && expandable && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-10"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)" }}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
        >
          <img
            src={photo}
            alt="Expanded profile"
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
            style={{ animation: "scaleUp 0.2s ease-out forwards" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function BloodTypeBadge({ type, size = "sm" }) {
  const big = size === "lg";
  const isWide = (type || "").length >= 3; // AB+, AB- need a smaller, tighter fit
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold shrink-0 leading-none"
      style={{
        width: big ? 40 : 28,
        height: big ? 40 : 28,
        background: C.brick,
        color: "#fff",
        fontFamily: F,
        fontSize: big ? (isWide ? 11 : 13) : isWide ? 9 : 10.5,
        letterSpacing: isWide ? "-0.3px" : "normal",
        padding: 0,
      }}
    >
      {type}
    </span>
  );
}

/* Small step-progress dots used across the multi-step Need Blood flow */
function StepDots({ step }) {
  const steps = ["type", "location", "results"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <span
          key={s}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: i === idx ? 22 : 7, background: i <= idx ? C.brick : C.border }}
        />
      ))}
    </div>
  );
}

/* Detects a touch/phone-class device so Call can either open the
   native dialer directly (mobile) or surface the number to read/copy
   (desktop, where there's usually no dialer to hand off to). */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/* ---------------------------------------------------------------
   Call button — shown once a request has been approved on either
   side. On a phone it hands off straight to the native dialer via a
   tel: link. On desktop (no dialer to hand off to) it opens a small
   popover with the number, a tel: link for apps that do handle it,
   and a copy-to-clipboard fallback.
------------------------------------------------------------------ */
function CallButton({ phone, name }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleClick = () => {
    if (isMobileDevice()) {
      window.location.href = `tel:${phone}`;
      return;
    }
    setOpen((o) => !o);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — the number is still visible to copy by hand
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleClick}
        className="shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full text-white transition-opacity hover:opacity-90"
        style={{ background: C.forest, fontFamily: F, fontWeight: 700 }}
      >
        <Phone size={13} /> Call
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 z-30 w-64 p-4 rounded-2xl bg-white"
          style={{ border: `1px solid ${C.border}`, boxShadow: "0 24px 60px -18px rgba(0,0,0,0.25)", animation: "fadeUp 0.15s ease" }}
        >
          <p className="text-[11px]" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            {name.split(" ")[0]}'s number
          </p>
          <p className="text-[17px] font-bold tracking-tight mt-0.5" style={{ color: C.ink, fontFamily: F }}>
            {phone}
          </p>
          <div className="flex items-center gap-2 mt-3.5">
            <a
              href={`tel:${phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-full text-white"
              style={{ background: C.ink, fontFamily: F, fontWeight: 700 }}
            >
              <Phone size={12} /> Call
            </a>
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
              style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 700 }}
            >
              <Copy size={12} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Real location picker backed by OpenStreetMap + Leaflet.
------------------------------------------------------------------ */
function MapPicker({ value, onPick, initialCoords = null }) {
  const [coords, setCoords] = useState(initialCoords);

  return (
    <div>
      <LocationMap
        value={coords}
        onChange={(next, label) => {
          setCoords(next);
          // 2nd arg = the real coordinates, so callers can run a true distance search.
          onPick(label || `Selected location (${next.lat.toFixed(4)}, ${next.lng.toFixed(4)})`, next);
        }}
        height={300}
      />
      {value && (
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: C.sub, fontFamily: F }}>
          <Navigation size={12} /> Selected: <span style={{ color: C.ink, fontWeight: 600 }}>{value}</span>
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Map modal — opens the real map as a floating window instead
   of expanding inline (which used to push list items around and crowd
   the bottom of the screen). Same overlay pattern as Avatar's
   tap-to-expand photo view.
------------------------------------------------------------------ */
function MapModal({ label, value, onPick, onClose, initialCoords = null, readOnly = false }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[24px] bg-white p-5 sm:p-6"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.4)", animation: "modalIn 0.16s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>{label}</h3>
          <button
            onClick={onClose}
            aria-label="Close map"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F4F5]"
          >
            <X size={15} color={C.sub} />
          </button>
        </div>
        {readOnly ? (
  <LocationMap
    value={initialCoords}
    onChange={undefined}
    readOnly={true}
    height={300}
  />
) : (
  <MapPicker value={value} onPick={onPick} initialCoords={initialCoords} />
)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   File-type icon badges — used by the chat attachment preview so a
   PDF/DOCX/PPTX/XLSX/ZIP etc. reads as a real document card instead
   of a plain filename-as-link. Each kind gets a distinct icon +
   color, matching the badge treatment used for blood types.
------------------------------------------------------------------ */
function fileKind(name = "", mimeType = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf")
    return { label: "PDF", color: "#D6303F", tint: "#FBEAEA" };
  if (["doc", "docx"].includes(ext) || mimeType.includes("word"))
    return { label: "DOC", color: "#1D4ED8", tint: "#DCEEFF" };
  if (["ppt", "pptx"].includes(ext) || mimeType.includes("presentation"))
    return { label: "PPT", color: "#C2410C", tint: "#FDE7D6" };
  if (["xls", "xlsx", "csv"].includes(ext) || mimeType.includes("sheet") || mimeType === "text/csv")
    return { label: "XLS", color: "#15803D", tint: "#DEF5E4" };
  if (["zip", "rar", "7z"].includes(ext))
    return { label: "ZIP", color: "#7C3AED", tint: "#EDE7FB" };
  if (ext === "txt" || mimeType === "text/plain")
    return { label: "TXT", color: "#52525B", tint: "#F4F4F5" };
  return { label: ext ? ext.toUpperCase().slice(0, 4) : "FILE", color: "#52525B", tint: "#F4F4F5" };
}

/* A richer attachment card for non-image files in chat — colored file
   icon, name, kind badge and size, with a download affordance, instead
   of the plain paperclip-and-filename link this used to be. */
function FileBubble({ file, isMine }) {
  const meta = fileKind(file.name, file.mimeType);
  const sizeLabel =
    typeof file.size === "number"
      ? file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`
      : null;

  return (
    <a
      href={file.url}
      download={file.name}
      className="flex items-center gap-3 px-3 py-3 rounded-2xl no-underline transition-transform hover:scale-[1.01]"
      style={{
        background: isMine ? "#1C1C1C" : "#fff",
        border: `1px solid ${isMine ? "rgba(255,255,255,0.12)" : C.border}`,
        minWidth: 232,
        maxWidth: 260,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-extrabold"
        style={{ background: meta.tint, color: meta.color, fontFamily: F, fontSize: 10, letterSpacing: "0.2px" }}
      >
        {meta.label}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-semibold truncate"
          style={{ color: isMine ? "#fff" : C.ink, fontFamily: F }}
          title={file.name}
        >
          {file.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[9.5px] font-extrabold px-1.5 py-[1px] rounded"
            style={{ background: meta.tint, color: meta.color, fontFamily: F, letterSpacing: "0.3px" }}
          >
            {meta.label}
          </span>
          {sizeLabel && (
            <span className="text-[10.5px]" style={{ color: isMine ? "rgba(255,255,255,0.55)" : C.faint, fontFamily: F }}>
              {sizeLabel}
            </span>
          )}
        </div>
      </div>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: isMine ? "rgba(255,255,255,0.12)" : C.chip }}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isMine ? "#fff" : C.sub} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      </span>
    </a>
  );
}

/* ---------------------------------------------------------------
   Notification bell + dropdown
------------------------------------------------------------------ */
function NotificationBell({ notifications, ready, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState(null);
  const ref = useRef(null);
  // Seeded with the first snapshot's newest id so notifications that already
  // existed when the page loaded don't ring the bell / pop a toast.
  const prevIdRef = useRef(notifications[0]?.id ?? null);
  const seededRef = useRef(false);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // A new notification landed (its id is new since the last render) —
  // ring the bell briefly and show a toast preview. This is computed
  // during render by comparing against a ref, per React's guidance for
  // "adjusting state when a prop changes" — calling setState directly
  // inside an effect body (rather than a timer/event callback) causes
  // an extra cascading render, which is what react-hooks/set-state-in-effect
  // warns about. Skip while the full dropdown is already open, since
  // that's showing the same information.
  const latestId = notifications[0]?.id ?? null;
  if (!ready) {
    // Subscription hasn't delivered yet — nothing to compare against.
    seededRef.current = false;
  } else if (!seededRef.current) {
    // First real snapshot: adopt whatever already exists silently, so old
    // notifications don't ring the bell or pop a toast on page load.
    seededRef.current = true;
    prevIdRef.current = latestId;
  } else if (latestId !== prevIdRef.current) {
    prevIdRef.current = latestId;
    if (latestId && !open && !notifications[0].read) {
      setRinging(true);
      setToast(notifications[0]);
    }
  }

  // These effects only call setState from inside a timer callback (an
  // async event, not the effect body itself), so they're the correct
  // place for the actual auto-hide behavior.
  useEffect(() => {
    if (!ringing) return;
    const t = setTimeout(() => setRinging(false), 820);
    return () => clearTimeout(t);
  }, [ringing]);

  // Auto-close after 3 seconds of inactivity
  useEffect(() => {
    if (open && !hover) {
      const t = setTimeout(() => setOpen(false), 3000);
      return () => clearTimeout(t);
    }
  }, [open, hover]);

  return (
    <div 
      className="relative" 
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={() => { setOpen((o) => !o); setToast(null); }}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150"
        style={{ background: open || hover ? C.chip : "transparent" }}
      >
        <Bell size={17} color={C.ink} strokeWidth={1.8} style={ringing ? { animation: "bellRing 0.4s ease-in-out 2", transformOrigin: "50% 20%" } : undefined} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-[3px] rounded-full flex items-center justify-center"
            style={{ background: C.brick, border: "1.5px solid #fff", animation: "pulseDot 2s ease-in-out infinite" }}
          >
            <span className="text-[9px] font-extrabold text-white leading-none" style={{ fontFamily: F }}>
              {unread > 9 ? "9+" : unread}
            </span>
          </span>
        )}
      </button>

      {toast && !open && (
        <div
          className="absolute right-0 top-12 z-30 w-[300px] p-3.5 rounded-2xl bg-white flex items-start gap-2.5 pointer-events-none"
          style={{ border: `1px solid ${C.border}`, boxShadow: "0 24px 60px -18px rgba(0,0,0,0.25)", animation: "toastInOut 2.5s ease forwards" }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: toast.tone === "success" ? C.mint : C.blush }}>
            {toast.tone === "success" ? <Check size={13} color="#1F6B3A" /> : <Bell size={13} color={C.brickDark} />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px]" style={{ color: C.ink, fontFamily: F, fontWeight: 700 }}>{toast.title}</p>
            <p className="text-[12px] mt-0.5 leading-relaxed truncate" style={{ color: C.sub, fontFamily: F }}>{toast.body}</p>
          </div>
        </div>
      )}

      <div
        className="absolute right-0 top-12 z-30 w-[340px] max-h-[440px] overflow-y-auto rk-scroll rounded-2xl bg-white"
        style={{
          border: `1px solid ${C.border}`,
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.25)",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          transformOrigin: "top right",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.96)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden"
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span className="text-[14.5px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>Notifications</span>
            {unread > 0 && (
              <button onClick={onMarkAllRead} className="text-[11.5px] px-2.5 py-1 rounded-full transition-colors hover:bg-[#F4F4F5]" style={{ color: C.brick, fontFamily: F, fontWeight: 700 }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3.5" style={{ background: C.chip }}>
                <Bell size={17} color={C.faint} />
              </div>
              <p className="text-[13.5px] font-semibold" style={{ color: C.ink, fontFamily: F }}>You're all caught up</p>
              <p className="text-[12px] mt-1 max-w-[220px]" style={{ color: C.sub, fontFamily: F }}>Updates on your requests and messages will show up here.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[#FAFAFA]"
                  style={{ borderBottom: `1px solid ${C.border}`, background: n.read ? "transparent" : "#FEF6F6" }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: n.tone === "success" ? C.mint : C.blush }}>
                    {n.tone === "success" ? <Check size={13} color="#1F6B3A" /> : <Bell size={13} color={C.brickDark} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]" style={{ color: C.ink, fontFamily: F, fontWeight: 700 }}>{n.title}</p>
                    <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: C.sub, fontFamily: F }}>{n.body}</p>
                    <p className="text-[10.5px] mt-1.5" style={{ color: C.faint, fontFamily: F, fontWeight: 600 }}>{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: C.brick }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      
    </div>
  );
}

/* Call button inside a chat header: fetches the other person's number via the
   request's contacts subcollection (readable only because the request is approved). */
function ThreadCallButton({ thread, meUid }) {
  const otherUid = thread.participants.find((p) => p !== meUid);
  const phone = useApprovedPhone(thread.requestId || thread.id, otherUid, true);
  const name = (otherUid && thread.names?.[otherUid]) || "Contact";
  if (!phone) return null;
  return <CallButton phone={phone} name={name} />;
}

/* ---------------------------------------------------------------
   Inbox — thread list + a simple chat view. All state-local; no
   messages are actually delivered anywhere.
------------------------------------------------------------------ */
function InboxPanel({ me, threads, activeThreadId, onSelectThread, onSend, onMarkRead, onBack }) {
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [messages, setMessages] = useState([]);
  const active = threads.find((t) => t.id === activeThreadId);
  const activeId = active?.id;

  // Live messages for the open conversation.
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setMessages([]);
    const unsub = subscribeMessages(activeId, setMessages, (e) => setSendError(e.message));
    onMarkRead?.(activeId);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // New message arrived while this thread is open -> keep it marked read.
  useEffect(() => {
    if (activeId && (active?.unread?.[me.uid] || 0) > 0) onMarkRead?.(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.unread?.[me.uid]]);

  const otherName = (t) => {
    const otherUid = t.participants.find((p) => p !== me.uid);
    return (otherUid && t.names?.[otherUid]) || "Conversation";
  };
  const initialsOf = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, activeThreadId]);

  const doSend = async (payload) => {
    if (!active) return;
    setSendError("");
    try {
      await onSend(active.id, payload);
    } catch (e) {
      setSendError(e?.message || "Couldn't send that message.");
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    setDraft("");
    doSend({ type: "text", text });
  };

  // Attachments are stored inline in the message doc, and Firestore caps a
  // doc at 1 MiB, so files above MAX_INLINE_ATTACHMENT_BYTES are refused with
  // a clear message rather than failing silently at the database.
  const handleAttachment = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;

    if (file.size > MAX_INLINE_ATTACHMENT_BYTES) {
      setSendError(`"${file.name}" is too large. Attachments can be up to ${Math.round(MAX_INLINE_ATTACHMENT_BYTES / 1024)} KB.`);
      return;
    }

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.onload = () =>
      doSend({
        type: isImage ? "image" : "file",
        url: reader.result,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });
    reader.onerror = () => setSendError(`Couldn't attach "${file.name}".`);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* thread list */}
      <div className={`w-full sm:w-72 shrink-0 flex-col ${active ? "hidden sm:flex" : "flex"}`} style={{ borderRight: `1px solid ${C.border}` }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="text-[17px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>Inbox</h2>
        </div>
        <div className="flex-1 overflow-y-auto rk-scroll">
          {threads.length === 0 ? (
            <p className="text-sm px-5 py-8 text-center" style={{ color: C.sub, fontFamily: F }}>
              No conversations yet. Once a request is approved, you can chat here.
            </p>
          ) : (
            threads.map((t) => {
              const name = otherName(t);
              const unread = (t.unread?.[me.uid] || 0) > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectThread(t.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F9F9F9]"
                  style={{ background: activeThreadId === t.id ? C.chip : "transparent", borderBottom: `1px solid ${C.border}` }}
                >
                  <Avatar initials={initialsOf(name)} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>{name}</span>
                      {unread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.brick }} />}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: unread ? C.ink : C.sub, fontFamily: F, fontWeight: unread ? 700 : 400 }}>
                      {t.lastMessage || "Say hello"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* active thread */}
      <div className={`flex-1 flex-col min-w-0 ${active ? "flex" : "hidden sm:flex"}`}>
        {active ? (
          <>
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <button onClick={onBack} className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F4F4F5]">
                <ArrowLeft size={16} color={C.ink} />
              </button>
              <Avatar initials={initialsOf(otherName(active))} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>{otherName(active)}</p>
                <p className="text-[11px]" style={{ color: C.sub, fontFamily: F }}>{active.context}</p>
              </div>
              <ThreadCallButton thread={active} meUid={me.uid} />
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto rk-scroll px-5 py-4 flex flex-col gap-2.5">
              {messages.length === 0 ? (
                <p className="text-xs text-center mt-8" style={{ color: C.faint, fontFamily: F }}>No messages yet — say hello.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.from === me.uid;
                  return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] rounded-2xl text-sm overflow-hidden"
                      style={{
                        background: m.type === "image" || m.type === "file" ? "transparent" : mine ? C.ink : C.chip,
                        color: mine ? "#fff" : C.ink,
                        fontFamily: F,
                        padding: m.type === "image" || m.type === "file" ? 0 : "8px 14px",
                        borderBottomRightRadius: mine ? 4 : 16,
                        borderBottomLeftRadius: mine ? 16 : 4,
                      }}
                    >
                      {m.type === "image" ? (
                        <img src={m.url} alt={m.name || "Attachment"} className="max-w-[220px] max-h-[220px] object-cover block" />
                      ) : m.type === "file" ? (
                        <FileBubble file={m} isMine={mine} />
                      ) : (
                        m.text
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
            {sendError && (
              <p className="text-xs px-5 py-2" style={{ background: C.brickTint, color: C.brickDark, fontFamily: F }}>{sendError}</p>
            )}
            <div className="flex items-end gap-1.5 px-4 py-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*,.zip,.txt,.csv"
                hidden
                onChange={handleAttachment}
              />
              <button
                onClick={() => setShowCamera(true)}
                aria-label="Take a photo"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ background: C.chip }}
              >
                <Camera size={16} color={C.ink} strokeWidth={2} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach a file"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ background: C.chip }}
              >
                <Paperclip size={16} color={C.ink} strokeWidth={2} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message…"
                className="flex-1 text-sm bg-transparent outline-none px-3.5 py-2 rounded-full"
                style={{ background: C.chip, color: C.ink, fontFamily: F }}
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                aria-label="Send"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                style={{ background: C.ink, opacity: draft.trim() ? 1 : 0.35 }}
              >
                <Send size={14} color="#fff" style={{ marginLeft: 1 }} />
              </button>
            </div>
          </>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center">
            <p className="text-sm" style={{ color: C.faint, fontFamily: F }}>Select a conversation</p>
          </div>
        )}
      </div>

      {showCamera && (
        <CameraModal
          onCapture={(dataUrl) => {
            setShowCamera(false);
            // dataURL ~= 1.37x the byte size; refuse anything that would bust the 1 MiB doc cap.
            if (dataUrl.length * 0.75 > MAX_INLINE_ATTACHMENT_BYTES) {
              setSendError("That photo is too large to send. Try again from further away or attach a smaller image.");
              return;
            }
            doSend({ type: "image", url: dataUrl, name: "Photo" });
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

/*camera model function for camera in chat */


function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Camera access was denied or unavailable."));
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-[24px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold" style={{ color: C.ink, fontFamily: F }}>Take a photo</h3>
          <button onClick={onClose} aria-label="Close camera" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F4F4F5]">
            <X size={15} color={C.sub} />
          </button>
        </div>
        {error ? (
          <p className="text-sm py-8 text-center" style={{ color: C.sub, fontFamily: F }}>{error}</p>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black" />
            <button
              onClick={capture}
              className="mt-4 w-full py-3 rounded-full text-sm text-white"
              style={{ background: C.ink, fontFamily: F, fontWeight: 700 }}
            >
              Capture
            </button>
          </>
        )}
      </div>
    </div>
  );
}
/* ---------------------------------------------------------------
   NEED BLOOD flow: pick blood type -> pick location -> donor list
   -> request -> wait for approval -> contact unlocks + chat opens
------------------------------------------------------------------ */
function NeedBloodFlow({ me, sent, donorSync, onSent, onCancel, onReopen, onOpenThread }) {
  // step: "type" | "location" | "details" | "results"
  const [step, setStep] = useState(sent.length > 0 ? "results" : "type");
  const [bloodType, setBloodType] = useState(sent[0]?.bloodType || "");
  const [location, setLocation] = useState(sent[0]?.hospital || "");
  const [coords, setCoords] = useState(sent[0] ? { lat: sent[0].lat, lng: sent[0].lng } : null);
  const [units, setUnits] = useState(sent[0]?.units || 1);
  const [urgent, setUrgent] = useState(Boolean(sent[0]?.urgent));
  const [hospital, setHospital] = useState(sent[0]?.hospital || "");

  const [donors, setDonors] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState("");

  // Real donor search — runs whenever the person lands on the results step.
  useEffect(() => {
    if (step !== "results" || !bloodType || !coords) return;
    let cancelled = false;
    setSearching(true);
    setSearchError("");
    findNearbyDonors(bloodType, coords.lat, coords.lng, me.uid)
      .then((rows) => { if (!cancelled) setDonors(rows); })
      .catch((e) => { if (!cancelled) setSearchError(e?.message || "Couldn't search for donors."); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [step, bloodType, coords, me.uid]);

  const sendRequest = async (donor) => {
    setSendingId(donor.uid);
    setSendError("");
    try {
      await createDonationRequest({
        requesterUid: me.uid,
        requesterName: me.name || "Someone",
        requesterPhone: me.phone,
        donor,
        bloodType,
        units,
        urgent,
        hospital: hospital.trim() || location,
        lat: coords.lat,
        lng: coords.lng,
      });
      onSent?.(donor);
    } catch (e) {
      setSendError(
        e?.code === "permission-denied"
          ? "You've already sent this donor a request, or it can't be sent right now."
          : e?.message || "Couldn't send the request. Please try again."
      );
    } finally {
      setSendingId(null);
    }
  };

  const matchingDonors = donors;

  if (step === "type") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div
          className="w-full max-w-md p-8 sm:p-10 rounded-[24px]"
          style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 20px 50px -30px rgba(0,0,0,0.18)" }}
        >
          <div className="flex justify-center mb-6">
            <StepDots step="type" />
          </div>

          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.brickTint, border: `1px solid #F3D3D5` }}>
              <Droplet size={17} color={C.brick} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[19px] font-bold tracking-tight leading-tight" style={{ color: C.ink, fontFamily: F }}>What blood type do you need?</h2>
              <p className="text-[12.5px] mt-0.5" style={{ color: C.sub, fontFamily: F }}>We'll only show donors of this exact type nearby.</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {BLOOD_TYPES.map((bt) => {
              const selected = bloodType === bt;
              return (
                <button
                  key={bt}
                  onClick={() => setBloodType(bt)}
                  aria-pressed={selected}
                  className="relative flex items-center justify-center py-3.5 rounded-xl transition-all duration-150"
                  style={{
                    background: selected ? C.brickTint : "#fff",
                    border: `1.5px solid ${selected ? C.brick : C.border}`,
                  }}
                >
                  <span className="text-[15px] font-bold tracking-tight" style={{ color: selected ? C.brick : C.ink, fontFamily: F }}>
                    {bt}
                  </span>
                  {selected && (
                    <span
                      className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                      style={{ background: C.brick }}
                    >
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep("location")}
            disabled={!bloodType}
            className="mt-7 w-full py-3 rounded-full text-sm text-white flex items-center justify-center gap-1.5 transition-opacity"
            style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: bloodType ? 1 : 0.35 }}
          >
            Continue <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  if (step === "location") {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header row stays pinned above the picker — when a real maps SDK
            replaces MapPicker and expands to fill the space below, Back
            and the title remain reachable instead of being covered. */}
        <div className="flex items-center gap-3 px-6 py-4 sm:px-8" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={() => setStep("type")}
            aria-label="Back"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#F4F4F5]"
          >
            <ArrowLeft size={15} color={C.ink} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight truncate" style={{ color: C.ink, fontFamily: F }}>Where are you looking?</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: C.sub, fontFamily: F }}>Pick the nearest spot — this narrows the donor list by distance.</p>
          </div>
          <StepDots step="location" />
        </div>

        <div className="flex-1 overflow-y-auto rk-scroll px-6 py-6 sm:px-8 flex flex-col items-center">
          <div className="w-full max-w-xl">
            <MapPicker
              value={location}
              initialCoords={coords}
              onPick={(label, c) => { setLocation(label); if (c) setCoords(c); }}
            />
            <button
              onClick={() => setStep("details")}
              disabled={!location || !coords}
              className="mt-6 px-6 py-3 rounded-full text-sm text-white flex items-center gap-1.5 transition-opacity"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: location && coords ? 1 : 0.35 }}
            >
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "details") {
    const canGo = hospital.trim().length >= 2 && units >= 1;
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 px-6 py-4 sm:px-8" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={() => setStep("location")}
            aria-label="Back"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#F4F4F5]"
          >
            <ArrowLeft size={15} color={C.ink} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight truncate" style={{ color: C.ink, fontFamily: F }}>A few details</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: C.sub, fontFamily: F }}>Donors see this when deciding whether to help.</p>
          </div>
          <StepDots step="location" />
        </div>

        <div className="flex-1 overflow-y-auto rk-scroll px-6 py-6 sm:px-8 flex flex-col items-center">
          <div className="w-full max-w-md flex flex-col gap-5">
            <div>
              <label className="block text-[12px] mb-1.5" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>Hospital or place where blood is needed</label>
              <input
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="e.g. Regency Hospital, Kanpur"
                className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: C.chip, color: C.ink, fontFamily: F, border: `1px solid ${C.border}` }}
              />
            </div>

            <div>
              <label className="block text-[12px] mb-1.5" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>Units needed</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUnits((u) => Math.max(1, u - 1))}
                  aria-label="Fewer units"
                  className="w-9 h-9 rounded-full text-lg leading-none"
                  style={{ border: `1px solid ${C.border}`, color: C.ink }}
                >−</button>
                <span className="text-base font-bold w-6 text-center" style={{ color: C.ink, fontFamily: F }}>{units}</span>
                <button
                  onClick={() => setUnits((u) => Math.min(20, u + 1))}
                  aria-label="More units"
                  className="w-9 h-9 rounded-full text-lg leading-none"
                  style={{ border: `1px solid ${C.border}`, color: C.ink }}
                >+</button>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-4 h-4 accent-[#D6303F]" />
              <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>This is urgent</span>
            </label>

            <button
              onClick={() => setStep("results")}
              disabled={!canGo}
              className="mt-2 px-6 py-3 rounded-full text-sm text-white flex items-center justify-center gap-1.5 transition-opacity"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: canGo ? 1 : 0.35 }}
            >
              Find donors <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === "results"
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 sm:px-8 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>Donors near {location || "you"}</h2>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: C.sub, fontFamily: F }}>
            {searching ? "Searching…" : `${matchingDonors.length} ${matchingDonors.length === 1 ? "match" : "matches"}`} for <BloodTypeBadge type={bloodType} /> nearest first
          </p>
        </div>
        <button
          onClick={() => setStep("type")}
          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Change type / location
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rk-scroll px-6 py-4 sm:px-8 flex flex-col gap-2.5">
        {sendError && (
          <p className="text-xs px-4 py-2.5 rounded-xl" style={{ background: C.brickTint, color: C.brickDark, fontFamily: F }}>{sendError}</p>
        )}
        {searchError ? (
          <p className="text-sm text-center py-10" style={{ color: C.brickDark, fontFamily: F }}>{searchError}</p>
        ) : searching ? (
          <p className="text-sm text-center py-10" style={{ color: C.sub, fontFamily: F }}>Looking for donors near you…</p>
        ) : matchingDonors.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: C.sub, fontFamily: F }}>
            No registered {bloodType} donors within 25 km yet. As more people join, they'll appear here.
          </p>
        ) : (
          matchingDonors.map((d) => {
            const existing = sent.find((r) => r.donorUid === d.uid);
            return (
              <DonorCard
                key={d.uid}
                donor={d}
                request={existing}
                sending={sendingId === d.uid}
                onRequest={() => (existing?.status === "cancelled" ? onReopen(existing) : sendRequest(d))}
                onCancel={() => existing && onCancel(existing)}
                onOpenChat={() => existing?.threadId && onOpenThread(existing.threadId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* Fetches the OTHER person's phone once a request is approved. Rules only allow
   this read when the request between the two is approved, so it is never exposed
   early, and it works the same for donor and requester. */
function useApprovedPhone(requestId, otherUid, approved) {
  const [phone, setPhone] = useState(null);
  useEffect(() => {
    if (!approved || !requestId || !otherUid) { setPhone(null); return; }
    let cancelled = false;
    getContactPhone(requestId, otherUid).then((p) => { if (!cancelled) setPhone(p); });
    return () => { cancelled = true; };
  }, [requestId, otherUid, approved]);
  return phone;
}

function DonorCard({ donor, request, sending, onRequest, onCancel, onOpenChat }) {
  const initials = (donor.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const status = request?.status; // undefined | "pending" | "approved" | "declined" | "cancelled"
  // Never-requested donors, or ones whose request the person cancelled earlier
  // (that re-opens the same request). A declined donor is final.
  const canRequest = !status || status === "cancelled";
  const phone = useApprovedPhone(request?.id, donor.uid, status === "approved");
  const km = typeof donor.distanceKm === "number" ? donor.distanceKm.toFixed(1) : donor.distanceKm;

  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-shadow"
      style={{ border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
    >
      <Avatar initials={initials} size={44} tone={C.blush} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: F }}>{donor.name}</span>
          <BloodTypeBadge type={donor.bloodType} />
        </div>
        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
          <span className="text-xs flex items-center gap-1" style={{ color: C.sub, fontFamily: F }}>
            <MapPin size={11} /> {km} km away{donor.city ? ` · ${donor.city}` : ""}
          </span>
        </div>
        {/* Contact info stays hidden until the donor approves. */}
        {status === "approved" && (
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: C.forest, fontFamily: F, fontWeight: 600 }}>
            <Check size={11} /> Approved — you can now message or call {(donor.name || "them").split(" ")[0]}
          </p>
        )}
        {status === "declined" && (
          <p className="text-[11px] mt-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            This donor can't help right now.
          </p>
        )}
      </div>

      {canRequest && (
        <button
          onClick={onRequest}
          disabled={sending}
          className="shrink-0 text-xs px-3.5 py-2 rounded-full text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ background: C.brick, fontFamily: F, fontWeight: 700 }}
        >
          {sending ? "Sending…" : "Request"}
        </button>
      )}
      {status === "pending" && (
        <div className="shrink-0 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full" style={{ background: C.chip, color: C.sub, fontFamily: F, fontWeight: 600 }}>
            <Clock size={12} /> Waiting
          </span>
          <button
            onClick={onCancel}
            className="text-[11px] px-2.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
            style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}
          >
            Cancel
          </button>
        </div>
      )}
      {status === "approved" && (
        <div className="shrink-0 flex items-center gap-2">
          {phone && <CallButton phone={phone} name={donor.name || "Donor"} />}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
            style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 700 }}
          >
            <MessageCircle size={13} /> Message
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   DONATE BLOOD flow: nearby requesters list + a map view, with
   approve/decline. Also drives the inbox thread once approved.
------------------------------------------------------------------ */
function IncomingRequestCard({ r, distanceKm, onApprove, onDecline, onOpenThread, onShowMap, mapOpen, busy }) {
  const initials = (r.requesterName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const phone = useApprovedPhone(r.id, r.requesterUid, r.status === "approved");

  return (
    <div
      className="rounded-2xl transition-shadow overflow-hidden"
      style={{ border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
    >
      <div className="flex items-center gap-3.5 px-5 py-5">
        <Avatar initials={initials} size={46} tone={C.sky} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: F }}>{r.requesterName}</span>
            <BloodTypeBadge type={r.bloodType} />
            {r.urgent && <Pill tone="urgent">Urgent</Pill>}
          </div>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: C.sub, fontFamily: F }}>
              <MapPin size={11} /> {distanceKm != null ? `${distanceKm.toFixed(1)} km · ` : ""}{r.hospital}
            </span>
            <span className="text-xs" style={{ color: C.faint, fontFamily: F }}>{r.units} unit{r.units > 1 ? "s" : ""} needed</span>
            <span className="text-xs" style={{ color: C.faint, fontFamily: F }}>{timeAgo(r.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={onShowMap}
          aria-label="View on map"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: mapOpen ? C.chip : "transparent" }}
        >
          <MapPin size={15} color={C.sub} />
        </button>
      </div>

      <div className="flex items-center gap-2.5 px-5 py-4 min-h-[56px] rounded-b-2xl" style={{ borderTop: `1px solid ${C.border}`, background: C.sidebar }}>
        {r.status === "approved" ? (
          <div className="flex items-center gap-2 w-full">
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: C.mint, color: C.forest, fontFamily: F, fontWeight: 700 }}>
              <Check size={12} /> Approved
            </span>
            <div className="ml-auto flex items-center gap-2">
              {phone && <CallButton phone={phone} name={r.requesterName || "Requester"} />}
              <button
                onClick={() => onOpenThread(r.threadId)}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-white"
                style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 700 }}
              >
                <MessageCircle size={13} /> Message
              </button>
            </div>
          </div>
        ) : r.status === "declined" ? (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: C.chip, color: C.sub, fontFamily: F, fontWeight: 600 }}>
            <X size={12} /> Declined
          </span>
        ) : r.status === "cancelled" ? (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: C.chip, color: C.sub, fontFamily: F, fontWeight: 600 }}>
            <X size={12} /> Withdrawn by requester
          </span>
        ) : (
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={onDecline}
              disabled={busy}
              className="shrink-0 text-xs px-4 py-2 rounded-full transition-colors hover:bg-white disabled:opacity-50"
              style={{ border: `1px solid ${C.border}`, color: C.sub, fontFamily: F, fontWeight: 700 }}
            >
              Decline
            </button>
            <button
              onClick={onApprove}
              disabled={busy}
              className="shrink-0 text-xs px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: C.brick, fontFamily: F, fontWeight: 700, boxShadow: "0 10px 20px -10px rgba(214,48,63,0.55)" }}
            >
              {busy ? "Saving…" : "Approve"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DonateBloodFlow({ me, incoming, donorSync, onApprove, onDecline, onOpenThread }) {
  const [showMapFor, setShowMapFor] = useState(null); // request id
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  const myPos = donorSync.status === "ready" ? { lat: donorSync.lat, lng: donorSync.lng } : null;
  const distanceOf = (r) => (myPos ? haversineKm(myPos.lat, myPos.lng, r.lat, r.lng) : null);

  // Everything in `incoming` is already addressed to this donor (the query and
  // the security rules both enforce that). Withdrawn requests stay visible with
  // a "Withdrawn" label so a notification never points at something that vanished.
  const visible = incoming;

  const pendingCount = visible.filter((r) => r.status === "pending").length;
  const urgentCount = visible.filter((r) => r.status === "pending" && r.urgent).length;

  // Pending first, then urgent, then closest, then newest.
  const sorted = [...visible].sort((a, b) => {
    const rank = (r) => (r.status === "pending" ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    const da = distanceOf(a), db2 = distanceOf(b);
    if (da != null && db2 != null && da !== db2) return da - db2;
    return b.createdAt - a.createdAt;
  });

  const run = async (id, fn) => {
    setBusyId(id);
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e?.message || "That didn't go through. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-5 sm:px-8" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>Requests for you</h2>
        <p className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: F }}>
          People who asked you to donate {me.bloodType || "blood"}. Pending, urgent and closest first.
        </p>

        {donorSync.status === "syncing" && (
          <p className="text-[11.5px] mt-3" style={{ color: C.sub, fontFamily: F }}>Publishing your donor profile…</p>
        )}
        {donorSync.status === "error" && (
          <p className="text-[11.5px] mt-3 px-3 py-2 rounded-xl" style={{ background: C.brickTint, color: C.brickDark, fontFamily: F }}>
            You're not listed as a donor yet. {donorSync.reason}
          </p>
        )}

        {visible.length > 0 && (
          <div className="flex items-center gap-2 mt-3.5">
            <span className="px-3 py-1.5 rounded-full text-[11.5px] font-bold" style={{ background: C.chip, color: C.ink, fontFamily: F }}>
              {pendingCount} pending
            </span>
            {urgentCount > 0 && (
              <span className="px-3 py-1.5 rounded-full text-[11.5px] font-bold" style={{ background: C.blush, color: C.brickDark, fontFamily: F }}>
                {urgentCount} urgent
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rk-scroll px-6 py-4 sm:px-8 flex flex-col gap-3">
        {actionError && (
          <p className="text-xs px-4 py-2.5 rounded-xl" style={{ background: C.brickTint, color: C.brickDark, fontFamily: F }}>{actionError}</p>
        )}
        {sorted.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: C.sub, fontFamily: F }}>
            No requests yet. When someone asks you to donate, it appears here instantly.
          </p>
        ) : (
          sorted.map((r) => (
            <IncomingRequestCard
              key={r.id}
              r={r}
              distanceKm={distanceOf(r)}
              busy={busyId === r.id}
              mapOpen={showMapFor === r.id}
              onShowMap={() => setShowMapFor(showMapFor === r.id ? null : r.id)}
              onApprove={() => run(r.id, () => onApprove(r))}
              onDecline={() => run(r.id, () => onDecline(r))}
              onOpenThread={onOpenThread}
            />
          ))
        )}
      </div>

      {showMapFor && (() => {
        const activeRequest = incoming.find((r) => r.id === showMapFor);
        if (!activeRequest) return null;
        return (
          <MapModal
            label={activeRequest.hospital}
            value={activeRequest.hospital}
            initialCoords={{ lat: activeRequest.lat, lng: activeRequest.lng }}
            onPick={() => {}}
            onClose={() => setShowMapFor(null)}
            readOnly={true}
          />
        );
      })()}
    </div>
  );
}

/* ---------------------------------------------------------------
   Landing picker — the very first thing shown after sign-in. Kept
   intentionally minimal (brand mark, a short greeting, two choices)
   so the space stays empty until the person tells us which flow
   they want; nothing else renders until they pick one.
------------------------------------------------------------------ */
function ModeSelect({ onPick, userName, profileComplete = true }) {
  const options = [
    {
      key: "need",
      icon: Droplet,
      title: "I need blood",
      desc: "Find verified donors near you by blood type and send a request.",
      tint: C.blush,
      iconColor: C.brick,
    },
    {
      key: "donate",
      icon: HeartHandshake,
      title: "I want to donate",
      desc: "See nearby requests that match your blood type and respond.",
      tint: C.sky,
      iconColor: C.skyDark,
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center mb-10">
        <div className="mx-auto mb-5 flex items-center justify-center">
          <BrandMark size={40} />
        </div>
        <h1 className="text-[26px] sm:text-3xl font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>
          {userName ? `Welcome back, ${userName.split(" ")[0]}` : "Welcome to RaktJaal"}
        </h1>
        <p className="text-sm mt-2.5" style={{ color: C.sub, fontFamily: F }}>What would you like to do today?</p>
        {!profileComplete && (
          <p className="text-[12.5px] mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full" style={{ background: C.brickTint, color: C.brickDark, fontFamily: F, fontWeight: 600 }}>
            <ShieldCheck size={13} /> Finish your profile to unlock these
          </p>
        )}
      </div>

      <div className="w-full max-w-2xl grid sm:grid-cols-2 gap-4">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              className="group text-left p-6 sm:p-7 rounded-[28px] transition-all duration-200 hover:-translate-y-0.5"
              style={{ border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 24px 50px -24px rgba(0,0,0,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)")}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: opt.tint }}>
                <Icon size={20} color={opt.iconColor} />
              </div>
              <h3 className="text-base font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>{opt.title}</h3>
              <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: C.sub, fontFamily: F }}>{opt.desc}</p>
              <span
                className="inline-flex items-center gap-1 mt-5 text-xs transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: C.ink, fontFamily: F, fontWeight: 700 }}
              >
                Continue <ChevronRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Profile-incomplete gate — shown instead of Need/Donate Blood when
   the signed-in user hasn't filled out the required profile fields
   yet. Blocks both action flows until they do, since a donor or
   requester needs to be reachable (phone, blood type, address) for
   either flow to make sense.
------------------------------------------------------------------ */
function ProfileIncompleteGate({ missing, onGoToProfile }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div
        className="w-full max-w-md p-8 sm:p-10 rounded-[24px] text-center"
        style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 20px 50px -30px rgba(0,0,0,0.18)" }}
      >
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ background: C.brickTint, border: "1px solid #F3D3D5" }}>
          <ShieldCheck size={20} color={C.brick} />
        </div>
        <h2 className="text-[19px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>
          Complete your profile to continue
        </h2>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: C.sub, fontFamily: F }}>
          Donating or requesting blood needs a way for the other person to reach and verify you.
          You're missing {missing.length} detail{missing.length > 1 ? "s" : ""}:
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-3.5">
          {missing.map((f) => (
            <Pill key={f.key}>{f.label}</Pill>
          ))}
        </div>
        <button
          onClick={onGoToProfile}
          className="mt-7 w-full py-3 rounded-full text-sm text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Complete profile <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Signed-out state — same language as ProfilePage's
------------------------------------------------------------------ */
function SignedOut() {
  const router = useRouter();
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: C.paper }}>
      <style>{FONT_IMPORT}</style>
      <div className="w-full max-w-md text-center">
        <div className="mb-5 mx-auto flex items-center justify-center">
          <BrandMark size={40} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: C.ink, fontFamily: F }}>You're not signed in</h1>
        <p className="text-sm mb-7" style={{ color: C.sub, fontFamily: F }}>Log in to find donors or see nearby requests.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => router.push("/register")} className="px-5 py-2.5 rounded-full text-sm text-white transition-transform hover:scale-[1.04] active:scale-95" style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}>
            Create account
          </button>
          <button onClick={() => router.push("/login")} className="px-5 py-2.5 rounded-full text-sm transition-colors hover:bg-[#F4F4F5]" style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}>
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Root
------------------------------------------------------------------ */
// useSearchParams() opts the page out of static rendering unless it is inside
// a Suspense boundary, so the real page body lives in ActionPageInner and this
// default export just supplies the boundary.
export default function ActionPage() {
  return (
    <Suspense fallback={null}>
      <ActionPageInner />
    </Suspense>
  );
}

function ActionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Real signed-in identity: Firebase Auth for the uid/session, Firestore
  // ("users/{uid}") for the profile fields this page reads (name,
  // profilePhoto) — same source ProfilePage.jsx now reads from, replacing
  // the old Authstore.js localStorage placeholder.
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!authUser) {
      setUser(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    getUserProfile(authUser.uid).then((profile) => {
      if (cancelled) return;
      setUser(profile || { uid: authUser.uid, email: authUser.email || "" });
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, authUser]);

  // Deep-linked from the retired /request and /donor/signup pages
  // (?mode=need / ?mode=donate), or opened fresh from the picker.
  const initialMode = searchParams.get("mode");
  const [mode, setMode] = useState(
    initialMode === "need" || initialMode === "donate" ? initialMode : null
  );
  const [view, setView] = useState("main"); // "main" | "inbox"
  const [activeThreadId, setActiveThreadId] = useState(null);

  // Profile completeness is derived here (before the early returns below) so
  // the backend hook can run unconditionally, as hooks must.
  const profileComplete = getMissingProfileFields(user).length === 0;

  // Everything live: donor publishing, sent/incoming requests, threads, notifications.
  const backend = useRequestsBackend(user, profileComplete);

  if (authLoading || profileLoading) return null; // brief flash while Firebase resolves the session
  if (!user) return <SignedOut />;

  const missingProfileFields = getMissingProfileFields(user);

  const handleOpenThread = (threadId) => {
    if (!threadId) return;
    setActiveThreadId(threadId);
    setView("inbox");
  };

  const initials = user.name?.trim()
    ? user.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
    : "?";

  const inboxUnreadCount = backend.threads.filter((t) => (t.unread?.[user.uid] || 0) > 0).length;

  const SIDEBAR_NAV = [
    { key: "need", label: "Need Blood", icon: Droplet },
    { key: "donate", label: "Donate Blood", icon: HeartHandshake },
    { key: "inbox", label: "Inbox", icon: InboxIcon, badge: inboxUnreadCount > 0 },
  ];

  const isNavActive = (key) => (key === "inbox" ? view === "inbox" : mode === key && view === "main");

  const goTo = (key) => {
    if (key === "inbox") {
      setView("inbox");
    } else if (!profileComplete && (key === "need" || key === "donate")) {
      // Profile isn't complete — land on the gate instead of the flow.
      setMode(key);
      setView("main");
    } else {
      setMode(key);
      setView("main");
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ background: C.paper }}>
      <style>{FONT_IMPORT}</style>

      {/* ---- Left sidebar (desktop) ---- */}
      <aside
        className="hidden sm:flex sm:w-64 shrink-0 h-full flex-col"
        style={{ borderRight: `1px solid ${C.border}`, background: C.sidebar }}
      >
        <div className="px-6 pt-6 pb-1 flex flex-col items-start">
          <button onClick={() => router.push("/")} className="flex items-center gap-2.5 text-left">
            <BrandMark size={30} />
            <span className="text-base font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
          </button>

          {/* Back one "window" — from Need Blood, Donate Blood, or the
              Inbox, back to the mode picker. Shown whenever there's
              actually a previous window to return to (i.e. not already
              sitting on the blank picker). */}
          {(view === "inbox" || mode !== null) && (
            <BackArrow
              label="back to menu"
              onClick={() => {
                setView("main");
                setMode(null);
              }}
            />
          )}
        </div>

        <nav className="flex flex-col gap-1 px-4">
          {SIDEBAR_NAV.map((item) => {
            const active = isNavActive(item.key);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => goTo(item.key)}
                className="flex items-center gap-2.5 text-sm px-3.5 py-2.5 rounded-lg transition-colors text-left"
                style={{
                  background: active ? C.chip : "transparent",
                  color: active ? C.ink : C.sub,
                  fontFamily: F,
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={16} />
                {item.label}
                {item.badge && <span className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: C.brick }} />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* top chrome: mobile brand + nav on the left, corner icons on the right */}
        {/* top chrome: mobile brand + nav on the left, corner icons on the right */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="sm:hidden flex items-center gap-2.5">
            <button onClick={() => router.push("/")} className="flex items-center gap-2">
              <BrandMark size={26} />
              <span className="text-sm font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
            </button>
            {(view === "inbox" || mode !== null) && (
              <button
                onClick={() => { setView("main"); setMode(null); }}
                aria-label="Back to menu"
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ cursor: "pointer" }}
              >
                <ArrowLeft size={14} color={C.brick} strokeWidth={2.25} />
              </button>
            )}
          </div>

          <div className="hidden sm:block" />

          <div className="flex items-center gap-3">
            <NotificationBell notifications={backend.notifications} ready={backend.notificationsReady} onMarkAllRead={backend.markAllRead} />
            <button
              onClick={() => router.push("/profile")}
              aria-label="Your profile"
              className="rounded-full transition-shadow duration-150 rk-avatar-btn"
            >
              <Avatar photo={user.profilePhoto} initials={initials} size={32} tone={C.chip} expandable={false} />
            </button>
          </div>
        </div>

        {/* mobile nav row — the sidebar's job on small screens */}
        <div className="flex sm:hidden items-center gap-1 px-4 py-2.5 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          {SIDEBAR_NAV.map((item) => {
            const active = isNavActive(item.key);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => goTo(item.key)}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full shrink-0 transition-colors"
                style={{
                  background: active ? C.ink : "transparent",
                  color: active ? "#fff" : C.sub,
                  fontFamily: F,
                  fontWeight: 700,
                }}
              >
                <Icon size={13} />
                {item.label}
                {item.badge && <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : C.brick }} />}
              </button>
            );
          })}
        </div>

        {/* Body */}
        {view === "inbox" ? (
          <InboxPanel
            me={user}
            threads={backend.threads}
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThreadId}
            onSend={backend.send}
            onMarkRead={backend.markRead}
            onBack={() => setActiveThreadId(null)}
          />
        ) : (mode === "need" || mode === "donate") && !profileComplete ? (
          <ProfileIncompleteGate
            missing={missingProfileFields}
            onGoToProfile={() => router.push("/profile")}
          />
        ) : mode === "need" ? (
          <NeedBloodFlow
            me={user}
            sent={backend.sent}
            donorSync={backend.donorSync}
            onCancel={backend.cancel}
            onReopen={backend.reopen}
            onOpenThread={handleOpenThread}
          />
        ) : mode === "donate" ? (
          <DonateBloodFlow
            me={user}
            incoming={backend.incoming}
            donorSync={backend.donorSync}
            onApprove={backend.approve}
            onDecline={backend.decline}
            onOpenThread={handleOpenThread}
          />
        ) : (
          <ModeSelect
            userName={user.name}
            onPick={(key) => { setMode(key); setView("main"); }}
            profileComplete={profileComplete}
          />
        )}
      </div>
    </div>
  );
}