import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "./Authstore";
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

   IMPORTANT — this is UI only, deliberately:
   - No backend exists yet (see Authstore.js's own header comment).
   - "Nearby donors/requesters" below are seeded mock data, clearly
     marked MOCK_ — not real people, not a real directory query.
   - The map is an illustrative, non-interactive stand-in (a styled
     grid with pins) — not a real maps SDK. Picking a "location" just
     records a label, not real coordinates.
   - Notifications and inbox messages are held in local component
     state, not persisted or delivered anywhere. Nothing here sends
     a real push, SMS, or email to anyone.
   - Mock donor/requester phone numbers are placeholder digits used
     only to demo the post-approval "Call" affordance below — they
     are not real numbers and nothing here actually dials or reaches
     anyone. The signed-in user's own contact info still only ever
     comes from their real profile fields.
   - The signed-in user's own avatar uses their real uploaded profile
     photo (user.profilePhoto from Authstore) when present, the same
     field ProfilePage.jsx reads — mock donors/requesters keep
     initials since no photo exists for them.

   Wiring this to something real later means replacing:
     MOCK_DONORS / MOCK_REQUESTS     -> a real nearby-users query
     the map panel                   -> an actual maps SDK
     handleRequestSent/handleApprove -> real notification dispatch
     the inbox thread list           -> a real messaging backend
     CallButton's mock phone         -> the real matched user's number
   None of the surrounding layout needs to change to make that swap.
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
.rk-scroll { scrollbar-width: thin; scrollbar-color: #D4D4D8 transparent; }
.rk-scroll::-webkit-scrollbar { width: 7px; }
.rk-scroll::-webkit-scrollbar-track { background: transparent; }
.rk-scroll::-webkit-scrollbar-thumb { background: #D4D4D8; border-radius: 999px; }
/* Native <button> resets to cursor:default under Tailwind's preflight —
   this restores the hand cursor everywhere a button is clickable, the
   same feedback the profile avatar already gives via its inline style. */
button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
button:disabled { cursor: not-allowed; }
`;

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/* ---------------------------------------------------------------
   Mock data — clearly namespaced MOCK_ so nobody mistakes this for
   a real directory. Distances are pre-set fake numbers, not computed
   from any real location, since the map below is illustrative only.
   Phone numbers are placeholder digits for the Call-button demo only.
------------------------------------------------------------------ */
const MOCK_DONORS = [
  { id: "d1", name: "Ravi Mehta", bloodType: "O-", distanceKm: 1.2, city: "Kanpur", lastDonation: "3 months ago", verified: true, phone: "+91 98765 10001" },
  { id: "d2", name: "Ananya Iyer", bloodType: "O-", distanceKm: 2.6, city: "Kanpur", lastDonation: "5 months ago", verified: true, phone: "+91 98765 10002" },
  { id: "d3", name: "Farhan Ali", bloodType: "O-", distanceKm: 3.4, city: "Kanpur", lastDonation: "1 month ago", verified: false, phone: "+91 98765 10003" },
  { id: "d4", name: "Simran Kaur", bloodType: "O-", distanceKm: 4.1, city: "Kanpur", lastDonation: "6 months ago", verified: true, phone: "+91 98765 10004" },
  { id: "d5", name: "Devansh Rao", bloodType: "O-", distanceKm: 5.8, city: "Kanpur", lastDonation: "2 months ago", verified: false, phone: "+91 98765 10005" },
  { id: "d6", name: "Priyansh Gupta", bloodType: "A+", distanceKm: 1.8, city: "Kanpur", lastDonation: "4 months ago", verified: true, phone: "+91 98765 10006" },
  { id: "d7", name: "Neha Chawla", bloodType: "B+", distanceKm: 2.2, city: "Kanpur", lastDonation: "2 months ago", verified: false, phone: "+91 98765 10007" },
  { id: "d8", name: "Karan Malhotra", bloodType: "AB+", distanceKm: 3.9, city: "Kanpur", lastDonation: "7 months ago", verified: true, phone: "+91 98765 10008" },
];

const MOCK_REQUESTS = [
  { id: "r1", name: "Priya Sharma", bloodType: "O-", distanceKm: 0.9, hospital: "Kanpur District Hospital", units: 2, urgent: true, phone: "+91 98765 20001" },
  { id: "r2", name: "Aditya Verma", bloodType: "O-", distanceKm: 2.1, hospital: "Regency Hospital", units: 1, urgent: false, phone: "+91 98765 20002" },
  { id: "r3", name: "Meera Nair", bloodType: "O-", distanceKm: 3.7, hospital: "LPS Institute", units: 1, urgent: true, phone: "+91 98765 20003" },
];

function bloodTypeCompatible(need, donor) {
  // Exact-match only for this mock filter — real compatibility rules
  // (O- as universal donor, etc.) belong in a real matching engine.
  return need === donor;
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
function Avatar({ photo, initials, size = 40, tone = C.chip }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className="rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-opacity hover:opacity-85"
        style={{ width: size, height: size, background: tone, cursor: photo ? "pointer" : "default" }}
        onClick={() => photo && setExpanded(true)}
      >
        {photo ? (
          <img src={photo} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="font-semibold" style={{ color: C.ink, fontFamily: F, fontSize: Math.round(size * 0.36) }}>
            {initials}
          </span>
        )}
      </div>

      {expanded && photo && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-10"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)" }}
          onClick={() => setExpanded(false)}
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
   Illustrative "map" — a styled grid with pins, not a real maps SDK.
   Clicking a pin or the "Use this spot" button just records a label
   for the mock flow; there is no real geocoding happening.
------------------------------------------------------------------ */
function MapPicker({ value, onPick }) {
  const spots = [
    { id: "s1", label: "Civil Lines", x: "28%", y: "32%" },
    { id: "s2", label: "Swaroop Nagar", x: "58%", y: "22%" },
    { id: "s3", label: "Kakadeo", x: "42%", y: "58%" },
    { id: "s4", label: "Kalyanpur", x: "72%", y: "48%" },
    { id: "s5", label: "Govind Nagar", x: "20%", y: "68%" },
  ];

  return (
    <div>
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ height: 260, background: "linear-gradient(135deg, #EEF2F0, #E4ECF5)", border: `1px solid ${C.border}` }}
      >
        {/* faux street grid */}
        <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none">
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i + 1) * 14}%`} x2="100%" y2={`${(i + 1) * 14}%`} stroke="#B9C4C0" strokeWidth="1" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`v${i}`} x1={`${(i + 1) * 11}%`} y1="0" x2={`${(i + 1) * 11}%`} y2="100%" stroke="#B9C4C0" strokeWidth="1" />
          ))}
        </svg>

        {spots.map((s) => {
          const active = value === s.label;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.label)}
              className="absolute flex flex-col items-center transition-transform hover:scale-110"
              style={{ left: s.x, top: s.y, transform: "translate(-50%, -100%)" }}
            >
              <MapPin size={active ? 26 : 20} color={active ? C.brick : C.ink} fill={active ? C.brick : "none"} strokeWidth={active ? 0 : 1.8} />
              {active && (
                <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: C.ink, fontFamily: F, animation: "fadeUp 0.2s ease" }}>
                  {s.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {value && (
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: C.sub, fontFamily: F }}>
          <Navigation size={12} /> Selected: <span style={{ color: C.ink, fontWeight: 600 }}>{value}</span>
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Map modal — opens the illustrative map as a floating window instead
   of expanding inline (which used to push list items around and crowd
   the bottom of the screen). Same overlay pattern as Avatar's
   tap-to-expand photo view.
------------------------------------------------------------------ */
function MapModal({ label, value, onPick, onClose }) {
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
        <MapPicker value={value} onPick={onPick} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Notification bell + dropdown
------------------------------------------------------------------ */
function NotificationBell({ notifications, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState(null);
  const ref = useRef(null);
  const prevIdRef = useRef(notifications[0]?.id ?? null);
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
  if (latestId !== prevIdRef.current) {
    prevIdRef.current = latestId;
    if (latestId && !open) {
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); setToast(null); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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

      {open && (
        <div
          className="absolute right-0 top-12 z-30 w-[340px] max-h-[440px] overflow-y-auto rk-scroll rounded-2xl bg-white"
          style={{ border: `1px solid ${C.border}`, boxShadow: "0 24px 60px -18px rgba(0,0,0,0.25)", animation: "fadeUp 0.15s ease" }}
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
                    <p className="text-[10.5px] mt-1.5" style={{ color: C.faint, fontFamily: F, fontWeight: 600 }}>{n.time}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: C.brick }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Inbox — thread list + a simple chat view. All state-local; no
   messages are actually delivered anywhere.
------------------------------------------------------------------ */
function InboxPanel({ threads, activeThreadId, onSelectThread, onSend, onBack }) {
  const [draft, setDraft] = useState("");
  const active = threads.find((t) => t.id === activeThreadId);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [active?.messages?.length, activeThreadId]);

  const send = () => {
    if (!draft.trim() || !active) return;
    onSend(active.id, draft.trim());
    setDraft("");
  };

  // Local-only attachment stub: no upload happens (no backend yet), this
  // just drops a placeholder line into the thread so the affordance is
  // visible and wireable later — mirrors this file's "UI only" pattern.
  const handleAttachment = (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    onSend(active.id, `${kind === "camera" ? "📷" : "📎"} ${file.name}`);
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
              const lastMsg = t.messages[t.messages.length - 1];
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectThread(t.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F9F9F9]"
                  style={{ background: activeThreadId === t.id ? C.chip : "transparent", borderBottom: `1px solid ${C.border}` }}
                >
                  <Avatar initials={t.withInitials} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>{t.withName}</span>
                      {t.unread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.brick }} />}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: C.sub, fontFamily: F }}>
                      {lastMsg ? lastMsg.text : "Say hello"}
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
              <Avatar initials={active.withInitials} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>{active.withName}</p>
                <p className="text-[11px]" style={{ color: C.sub, fontFamily: F }}>{active.context}</p>
              </div>
              {active.phone && <CallButton phone={active.phone} name={active.withName} />}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto rk-scroll px-5 py-4 flex flex-col gap-2.5">
              {active.messages.length === 0 ? (
                <p className="text-xs text-center mt-8" style={{ color: C.faint, fontFamily: F }}>No messages yet — say hello.</p>
              ) : (
                active.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] px-3.5 py-2 rounded-2xl text-sm"
                      style={{
                        background: m.from === "me" ? C.ink : C.chip,
                        color: m.from === "me" ? "#fff" : C.ink,
                        fontFamily: F,
                        borderBottomRightRadius: m.from === "me" ? 4 : 16,
                        borderBottomLeftRadius: m.from === "me" ? 16 : 4,
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
              <input ref={fileInputRef} type="file" hidden onChange={(e) => handleAttachment(e, "file")} />
              <button
                onClick={() => setShowCamera(true)}
                aria-label="Take a photo"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#F4F4F5]"
              >
                <Camera size={16} color={C.sub} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach a file"
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#F4F4F5]"
              >
                <Paperclip size={16} color={C.sub} />
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
                <Send size={14} color="#fff" style={{ transform: "translate(1px, -1px)" }} />
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
          onCapture={(dataUrl) => { onSend(active.id, dataUrl); setShowCamera(false); }}
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
function NeedBloodFlow({ onRequestSent, requests, onOpenThread }) {
  const [step, setStep] = useState(requests.length > 0 ? "results" : "type"); // "type" | "location" | "results"
  const [bloodType, setBloodType] = useState(requests[0]?.bloodType || "");
  const [location, setLocation] = useState(requests[0]?.location || "");

  const matchingDonors = useMemo(
    () => MOCK_DONORS.filter((d) => bloodTypeCompatible(bloodType, d.bloodType)).sort((a, b) => a.distanceKm - b.distanceKm),
    [bloodType]
  );

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
            <MapPicker value={location} onPick={setLocation} />
            <button
              onClick={() => setStep("results")}
              disabled={!location}
              className="mt-6 px-6 py-3 rounded-full text-sm text-white flex items-center gap-1.5 transition-opacity"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: location ? 1 : 0.35 }}
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
            {matchingDonors.length} {matchingDonors.length === 1 ? "match" : "matches"} for <BloodTypeBadge type={bloodType} /> nearest first
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
        {matchingDonors.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: C.sub, fontFamily: F }}>No donors of this type found nearby right now.</p>
        ) : (
          matchingDonors.map((d) => {
            const existing = requests.find((r) => r.donorId === d.id);
            return (
              <DonorCard
                key={d.id}
                donor={d}
                request={existing}
                onRequest={() => onRequestSent(d)}
                onOpenChat={() => existing?.threadId && onOpenThread(existing.threadId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function DonorCard({ donor, request, onRequest, onOpenChat }) {
  const initials = donor.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const status = request?.status; // undefined | "pending" | "approved"

  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-shadow"
      style={{ border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
    >
      <Avatar initials={initials} size={44} tone={C.blush} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: F }}>{donor.name}</span>
          {donor.verified && (
            <Tooltip label="Verified donor">
              <ShieldCheck size={13} color={C.brick} />
            </Tooltip>
          )}
          <BloodTypeBadge type={donor.bloodType} />
        </div>
        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
          <span className="text-xs flex items-center gap-1" style={{ color: C.sub, fontFamily: F }}>
            <MapPin size={11} /> {donor.distanceKm} km away
          </span>
          <span className="text-xs" style={{ color: C.faint, fontFamily: F }}>Last donated {donor.lastDonation}</span>
        </div>
        {/* Contact info intentionally hidden until a donor approves a
            request — this mock only unlocks a thread + call once
            "approved", never before. */}
        {status === "approved" && (
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: C.forest, fontFamily: F, fontWeight: 600 }}>
            <Check size={11} /> Approved — you can now message or call {donor.name.split(" ")[0]}
          </p>
        )}
      </div>

      {!status && (
        <button
          onClick={onRequest}
          className="shrink-0 text-xs px-3.5 py-2 rounded-full text-white transition-opacity hover:opacity-85"
          style={{ background: C.brick, fontFamily: F, fontWeight: 700 }}
        >
          Request
        </button>
      )}
      {status === "pending" && (
        <span className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-full" style={{ background: C.chip, color: C.sub, fontFamily: F, fontWeight: 600 }}>
          <Clock size={12} /> Waiting
        </span>
      )}
      {status === "approved" && (
        <div className="shrink-0 flex items-center gap-2">
          <CallButton phone={donor.phone} name={donor.name} />
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
function DonateBloodFlow({ incoming, onApprove, onDecline, onOpenThread }) {
  const [showMapFor, setShowMapFor] = useState(null); // request id

  const pendingCount = incoming.filter((r) => !r.status).length;
  const urgentCount = incoming.filter((r) => !r.status && r.urgent).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-5 sm:px-8" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>Requests near you</h2>
        <p className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: F }}>People who need your blood type, closest first.</p>

        {incoming.length > 0 && (
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
        {incoming.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: C.sub, fontFamily: F }}>No pending requests right now — you'll be notified when one comes in.</p>
        ) : (
          incoming.map((r) => {
            const initials = r.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div
                key={r.id}
                className="rounded-2xl transition-shadow"
                style={{ border: `1px solid ${C.border}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
              >
                <div className="flex items-center gap-3.5 px-4.5 py-4">
                  <Avatar initials={initials} size={46} tone={C.sky} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: F }}>{r.name}</span>
                      <BloodTypeBadge type={r.bloodType} />
                      {r.urgent && <Pill tone="urgent">Urgent</Pill>}
                    </div>
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <span className="text-xs flex items-center gap-1" style={{ color: C.sub, fontFamily: F }}>
                        <MapPin size={11} /> {r.distanceKm} km · {r.hospital}
                      </span>
                      <span className="text-xs" style={{ color: C.faint, fontFamily: F }}>{r.units} unit{r.units > 1 ? "s" : ""} needed</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMapFor(showMapFor === r.id ? null : r.id)}
                    aria-label="View on map"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: showMapFor === r.id ? C.chip : "transparent" }}
                  >
                    <MapPin size={15} color={C.sub} />
                  </button>
                </div>

                <div className="flex items-center gap-2 px-4.5 py-3.5 rounded-b-2xl" style={{ borderTop: `1px solid ${C.border}`, background: C.sidebar }}>
                  {r.status === "approved" ? (
                    <>
                      <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: C.mint, color: C.forest, fontFamily: F, fontWeight: 700 }}>
                        <Check size={12} /> Approved
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <CallButton phone={r.phone} name={r.name} />
                        <button
                          onClick={() => onOpenThread(r.threadId)}
                          className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-white"
                          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 700 }}
                        >
                          <MessageCircle size={13} /> Message
                        </button>
                      </div>
                    </>
                  ) : r.status === "declined" ? (
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: C.chip, color: C.sub, fontFamily: F, fontWeight: 600 }}>
                      <X size={12} /> Declined
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onDecline(r.id)}
                        className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-white"
                        style={{ border: `1px solid ${C.border}`, color: C.sub, fontFamily: F, fontWeight: 700 }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => onApprove(r.id)}
                        className="ml-auto text-xs px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
                        style={{ background: C.brick, fontFamily: F, fontWeight: 700, boxShadow: "0 10px 20px -10px rgba(214,48,63,0.55)" }}
                      >
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showMapFor && (() => {
        const activeRequest = incoming.find((r) => r.id === showMapFor);
        if (!activeRequest) return null;
        return (
          <MapModal
            label={activeRequest.hospital}
            value={activeRequest.hospital}
            onPick={() => {}}
            onClose={() => setShowMapFor(null)}
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
function ModeSelect({ onPick, userName }) {
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
   Signed-out state — same language as ProfilePage's
------------------------------------------------------------------ */
function SignedOut() {
  const navigate = useNavigate();
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
          <button onClick={() => navigate("/register")} className="px-5 py-2.5 rounded-full text-sm text-white transition-transform hover:scale-[1.04] active:scale-95" style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}>
            Create account
          </button>
          <button onClick={() => navigate("/login")} className="px-5 py-2.5 rounded-full text-sm transition-colors hover:bg-[#F4F4F5]" style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}>
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
export default function ActionPage() {
  const navigate = useNavigate();
  const [user] = useState(() => getCurrentUser());
  const [mode, setMode] = useState(null); // null (blank picker) | "need" | "donate"
  const [view, setView] = useState("main"); // "main" | "inbox"

  // ---- Need-blood side state: requests the signed-in user has sent out ----
  const [sentRequests, setSentRequests] = useState([]); // { donorId, status: "pending"|"approved", threadId, location, bloodType }

  // ---- Donate side state: incoming requests to the signed-in user as donor ----
  const [incomingRequests, setIncomingRequests] = useState(
    MOCK_REQUESTS.map((r) => ({ ...r, status: undefined, threadId: null }))
  );

  // ---- Notifications (shared bell) ----
  const [notifications, setNotifications] = useState([]);

  // ---- Inbox threads (shared, keyed by id) ----
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  if (!user) return <SignedOut />;

  const pushNotification = (title, body, tone = "info") => {
    setNotifications((prev) => [
      { id: `n${Date.now()}`, title, body, tone, read: false, time: "Just now" },
      ...prev,
    ]);
  };

  const openOrCreateThread = (withName, withInitials, context, phone) => {
    const id = `t-${withName.replace(/\s+/g, "-").toLowerCase()}`;
    setThreads((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, withName, withInitials, context, phone, unread: false, messages: [] }];
    });
    return id;
  };

  // --- Need Blood: sending a request to a mock donor ---
  const handleRequestSent = (donor) => {
    setSentRequests((prev) => {
      if (prev.some((r) => r.donorId === donor.id)) return prev;
      return [...prev, { donorId: donor.id, status: "pending", threadId: null, bloodType: donor.bloodType, location: donor.city }];
    });
    pushNotification("Request sent", `You asked ${donor.name} for ${donor.bloodType} blood. We'll notify you when they respond.`);

    // Simulated donor response after a short delay — this is a UI demo of
    // the approval flow, not a real notification round-trip.
    setTimeout(() => {
      const initials = donor.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      const threadId = openOrCreateThread(donor.name, initials, `${donor.bloodType} donor · ${donor.distanceKm} km away`, donor.phone);
      setSentRequests((prev) => prev.map((r) => (r.donorId === donor.id ? { ...r, status: "approved", threadId } : r)));
      pushNotification(`${donor.name} approved your request`, "You can now message or call them directly.", "success");
    }, 2600);
  };

  // --- Donate Blood: approving/declining an incoming request ---
  const handleApprove = (requestId) => {
    setIncomingRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        const initials = r.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
        const threadId = openOrCreateThread(r.name, initials, `Needs ${r.bloodType} · ${r.hospital}`, r.phone);
        pushNotification("Request approved", `You approved ${r.name}'s request. You can message or call them now.`, "success");
        return { ...r, status: "approved", threadId };
      })
    );
  };

  const handleDecline = (requestId) => {
    setIncomingRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: "declined" } : r)));
  };

  const handleSendMessage = (threadId, text) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, { from: "me", text }] } : t))
    );
  };

  const handleOpenThread = (threadId) => {
    if (!threadId) return;
    setActiveThreadId(threadId);
    setView("inbox");
  };

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const initials = user.name?.trim()
    ? user.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
    : "?";

  const inboxUnreadCount = threads.filter((t) => t.unread).length;

  const SIDEBAR_NAV = [
    { key: "need", label: "Need Blood", icon: Droplet },
    { key: "donate", label: "Donate Blood", icon: HeartHandshake },
    { key: "inbox", label: "Inbox", icon: InboxIcon, badge: inboxUnreadCount > 0 },
  ];

  const isNavActive = (key) => (key === "inbox" ? view === "inbox" : mode === key && view === "main");

  const goTo = (key) => {
    if (key === "inbox") {
      setView("inbox");
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
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 px-6 py-6 text-left">
          <BrandMark size={30} />
          <span className="text-base font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
        </button>

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
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => navigate("/")} className="sm:hidden flex items-center gap-2">
            <BrandMark size={26} />
            <span className="text-sm font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
          </button>

          <div className="hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <NotificationBell notifications={notifications} onMarkAllRead={markAllRead} />
            <button onClick={() => navigate("/profile")} aria-label="Your profile" className="ml-1">
              <Avatar photo={user.profilePhoto} initials={initials} size={32} tone={C.chip} />
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
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThreadId}
            onSend={handleSendMessage}
            onBack={() => setActiveThreadId(null)}
          />
        ) : mode === "need" ? (
          <NeedBloodFlow
            onRequestSent={handleRequestSent}
            requests={sentRequests}
            onOpenThread={handleOpenThread}
          />
        ) : mode === "donate" ? (
          <DonateBloodFlow
            incoming={incomingRequests}
            onApprove={handleApprove}
            onDecline={handleDecline}
            onOpenThread={handleOpenThread}
          />
        ) : (
          <ModeSelect userName={user.name} onPick={(key) => { setMode(key); setView("main"); }} />
        )}
      </div>
    </div>
  );
}