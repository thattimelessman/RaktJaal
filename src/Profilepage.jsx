import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, saveCurrentUser, clearCurrentUser } from "./Authstore";
import {
  Droplet,
  Home,
  Phone,
  X,
  Check,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Plus,
  User,
  Laptop,
  Smartphone,
  KeyRound,
  Trash2,
  MoreHorizontal,
  Bell,
  HeartHandshake,
  Lock,
  Camera,
  RotateCcw,
  Loader2,
} from "lucide-react";

/* ---------------------------------------------------------------
   Design tokens — deliberately neutral (black / white / gray) to
   match the reference account-settings dialog. Brand red is used
   only where it's load-bearing: the blood-drop icon, the verified
   check, and the primary "Complete" CTA — everything else in this
   panel stays flat and quiet on purpose.
------------------------------------------------------------------ */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
@keyframes drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
@keyframes drift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,20px) scale(1.05); } }
@keyframes drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,40px) scale(1.1); } }
.rk-scroll { scrollbar-width: thin; scrollbar-color: #D4D4D8 transparent; }
.rk-scroll::-webkit-scrollbar { width: 7px; }
.rk-scroll::-webkit-scrollbar-track { background: transparent; }
.rk-scroll::-webkit-scrollbar-thumb { background: #D4D4D8; border-radius: 999px; }
.rk-scroll::-webkit-scrollbar-thumb:hover { background: #B8B8BE; }
`;

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
  blush: "#FDE2E4",
};
const F = "'Manrope', 'system-ui', sans-serif";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/* Same key AuthStore.js uses for its localStorage "directory". Duplicated
   here (read-only usage) purely so account deletion can wipe a user's own
   entry without adding new exports to AuthStore — swap for a real
   `deleteAccount()` API call once a backend exists. */
const DIRECTORY_KEY = "raktjaal_directory";

/* ---------------------------------------------------------------
   Photo processing — shared by both the identity-capture camera flow
   and the profile-photo file upload. Every stored photo (profile or
   identity) is squeezed under 400KB and re-encoded as JPEG, since
   that's the only practical way to hit a 400KB cap on a real phone
   photo — PNG at that size would mean an unusably tiny image.
------------------------------------------------------------------ */
const MAX_PHOTO_BYTES = 400 * 1024; // 400KB
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png"];

function dataUrlByteLength(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

/** Draws any image-like source (an <img> or a live <video> frame) onto a
 *  canvas and re-encodes as JPEG, stepping quality down and then physical
 *  size down until the result fits under maxBytes. Returns null only if
 *  even the smallest attempt can't get under the cap (essentially never
 *  happens for a normal photo). */
function drawToConstrainedDataUrl(source, sourceWidth, sourceHeight, maxBytes = MAX_PHOTO_BYTES) {
  let maxDim = 800;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
    const w = Math.max(1, Math.round(sourceWidth * scale));
    const h = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(source, 0, 0, w, h);

    for (const quality of [0.82, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlByteLength(dataUrl) <= maxBytes) return dataUrl;
    }
    maxDim = Math.round(maxDim * 0.7);
  }
  return null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Validates type, then compresses an uploaded File into a constrained
 *  data URL. Rejects non-JPEG/PNG uploads outright rather than silently
 *  converting them, so the person knows what happened. */
async function processPhotoFile(file) {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, reason: "Use a JPEG or PNG image." };
  }
  let rawDataUrl;
  try {
    rawDataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await loadImage(rawDataUrl);
    const constrained = drawToConstrainedDataUrl(img, img.width, img.height);
    if (!constrained) return { ok: false, reason: "Couldn't compress this image below 400KB — try a smaller photo." };
    return { ok: true, dataUrl: constrained };
  } catch {
    return { ok: false, reason: "Couldn't read that file — try a different photo." };
  }
}

/* ---------------------------------------------------------------
   Validation
   ---------------------------------------------------------------
   Every field below used to save whatever string InlineEditor was
   handed, no matter what — that's how "wbqdkasci" ends up saved as
   a phone number. Each validator here returns { valid, reason,
   normalized } so the UI can block a bad save and explain why,
   the same pattern Authpage.jsx already uses for password/email.
------------------------------------------------------------------ */

function validateName(v) {
  const trimmed = v.trim();
  if (!trimmed) return { valid: false, reason: "Name can't be empty.", normalized: trimmed };
  if (trimmed.length < 2) return { valid: false, reason: "Name is too short.", normalized: trimmed };
  if (!/^[A-Za-z][A-Za-z.'\- ]*$/.test(trimmed)) {
    return { valid: false, reason: "Use letters, spaces, hyphens, or apostrophes only.", normalized: trimmed };
  }
  return { valid: true, reason: "", normalized: trimmed.replace(/\s+/g, " ") };
}

/* General-purpose email check — RFC-reasonable, not restricted to a
   fixed provider allow-list, since a saved profile email may legitimately
   be a work/college/custom domain (unlike the sign-up gate in Authpage.jsx). */
function validateEmail(v) {
  const trimmed = v.trim();
  if (!trimmed) return { valid: false, reason: "Email can't be empty.", normalized: trimmed };
  const ok = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed);
  if (!ok) return { valid: false, reason: "Enter a full email address, like name@example.com", normalized: trimmed };
  return { valid: true, reason: "", normalized: trimmed.toLowerCase() };
}

/* Duplicate check — compares a candidate email (case-insensitive) against
   BOTH the primary email and the secondary list. Previously
   addSecondaryEmail only checked the secondary list, so the exact same
   address as the primary email slipped through as a "duplicate" secondary
   entry. Used by both the primary-email editor and the add-email editor,
   so the check is symmetric in either direction. */
function isDuplicateEmail(candidateNormalized, user, { excludePrimary = false, excludeSecondary = false } = {}) {
  if (!excludePrimary && candidateNormalized === (user.email || "").trim().toLowerCase()) return true;
  if (!excludeSecondary) {
    const list = Array.isArray(user.secondaryEmails) ? user.secondaryEmails : [];
    if (list.some((e) => e.trim().toLowerCase() === candidateNormalized)) return true;
  }
  return false;
}

/* Indian mobile numbers: 10 digits, first digit 6–9, with an optional
   +91 / 91 / 0 prefix and optional spaces or a single hyphen as separators.
   Landline / other-country numbers are intentionally out of scope — this
   product's contact-unlock flow assumes a reachable Indian mobile. */
function validatePhone(v) {
  const trimmed = v.trim();
  if (!trimmed) return { valid: false, reason: "Phone number can't be empty.", normalized: trimmed };
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digitsOnly);
  if (!match) {
    return {
      valid: false,
      reason: "Enter a valid 10-digit Indian mobile number, e.g. +91 98765 43210.",
      normalized: trimmed,
    };
  }
  const tenDigit = match[1];
  return { valid: true, reason: "", normalized: `+91 ${tenDigit.slice(0, 5)} ${tenDigit.slice(5)}` };
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

/* A representative set of major cities per state, used to power the City
   dropdown before any PIN lookup has run (e.g. the person picks State
   first). Not exhaustive — India has thousands of towns — so an "Other
   (type manually)" escape hatch is always offered alongside it. Once a PIN
   lookup succeeds, its real locality list from India Post replaces this
   static one for that field, since it's authoritative for that exact PIN. */
const STATE_CITIES = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Durg"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Karnal", "Ambala"],
  "Himachal Pradesh": ["Shimla", "Manali", "Dharamshala"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
  "Manipur": ["Imphal"],
  "Meghalaya": ["Shillong"],
  "Mizoram": ["Aizawl"],
  "Nagaland": ["Kohima", "Dimapur"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Chandigarh"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  "Sikkim": ["Gangtok"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad"],
  "Tripura": ["Agartala"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Silvassa"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Saket"],
  "Jammu and Kashmir": ["Srinagar", "Jammu"],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Puducherry"],
};
const OTHER_CITY = "__other__";

function validatePincode(v) {
  const trimmed = v.trim();
  if (!trimmed) return { valid: false, reason: "PIN code can't be empty.", normalized: trimmed };
  if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
    return { valid: false, reason: "Enter a valid 6-digit Indian PIN code.", normalized: trimmed };
  }
  return { valid: true, reason: "", normalized: trimmed };
}

/* Looks up state + real locality/post-office names for a 6-digit PIN via
   India Post's free, no-auth public API (api.postalpincode.in) — a plain
   client-side GET, no backend or API key involved. Returns null on any
   failure (bad PIN, offline, API down) so the caller falls back to manual
   state/city selection instead of silently corrupting the form. */
async function lookupPincode(pincode) {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = Array.isArray(data) ? data[0] : null;
    if (!result || result.Status !== "Success" || !Array.isArray(result.PostOffice) || result.PostOffice.length === 0) {
      return null;
    }
    const state = result.PostOffice[0].State;
    // Post offices sharing a PIN usually span a few neighbouring localities —
    // surface each distinct one as a selectable option rather than guessing one.
    const localities = [...new Set(result.PostOffice.map((po) => po.Name).filter(Boolean))];
    return { state, localities };
  } catch {
    return null;
  }
}

function validateRequiredText(v, label, minLen = 2) {
  const trimmed = v.trim();
  if (!trimmed) return { valid: false, reason: `${label} can't be empty.`, normalized: trimmed };
  if (trimmed.length < minLen) return { valid: false, reason: `${label} is too short.`, normalized: trimmed };
  return { valid: true, reason: "", normalized: trimmed };
}

/* Structured address. Legacy accounts (registered before this change)
   only ever saved a single free-text `city` string — normalizeAddress
   reads either shape and always hands the UI the structured one. */
function normalizeAddress(user) {
  if (user?.address && typeof user.address === "object") {
    return {
      street: user.address.street || "",
      city: user.address.city || "",
      state: user.address.state || "",
      pincode: user.address.pincode || "",
      country: user.address.country || "India",
    };
  }
  // Legacy fallback: old flat `city` field held whatever free text was typed.
  return { street: "", city: user?.city || "", state: "", pincode: "", country: "India" };
}

function addressIsComplete(addr) {
  return Boolean(addr.street.trim() && addr.city.trim() && addr.state.trim() && addr.pincode.trim());
}

function formatAddress(addr) {
  const parts = [addr.street, addr.city, addr.state, addr.pincode, addr.country].map((p) => (p || "").trim()).filter(Boolean);
  return parts.join(", ");
}

const REQUIRED_FIELDS = [
  { key: "name", label: "Full name" },
  { key: "phone", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "bloodType", label: "Blood type" },
];

function missingFields(user) {
  if (!user) return REQUIRED_FIELDS;
  return REQUIRED_FIELDS.filter((f) => {
    if (f.key === "address") return !addressIsComplete(normalizeAddress(user));
    return !user[f.key] || String(user[f.key]).trim() === "";
  });
}

/* Honest, local user-agent read — no external calls, no fabricated IP/geo. */
function readDeviceInfo() {
  if (typeof navigator === "undefined") return { os: "Unknown device", browser: "Unknown browser", isMobile: false };
  const ua = navigator.userAgent || "";
  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  const edgeMatch = ua.match(/Edg\/([\d.]+)/);
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
  if (edgeMatch) browser = `Edge ${edgeMatch[1]}`;
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
  else if (isSafari) browser = "Safari";

  return { os, browser, isMobile: /Android|iPhone|iPad|iPod/i.test(ua) };
}

/* ---------------------------------------------------------------
   Small reusable pieces
------------------------------------------------------------------ */
function Pill({ children }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[11.5px] font-medium shrink-0" style={{ background: C.chip, color: C.sub, fontFamily: F }}>
      {children}
    </span>
  );
}

/** Circular avatar — shows the stored profile photo when present,
 *  otherwise falls back to initials. Used in the Profile row and the
 *  sidebar identity chip, so both stay in sync automatically. */
function Avatar({ photo, initials, size = 40 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: C.chip }}
    >
      {photo ? (
        <img src={photo} alt="Profile" className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold" style={{ color: C.ink, fontFamily: F, fontSize: Math.round(size * 0.35) }}>
          {initials}
        </span>
      )}
    </div>
  );
}

/** Small hover/focus tooltip — used for the verified-donor badge and the
 *  new phone-verified badge. Keyboard accessible (shows on focus, not
 *  just mouseover) and dismisses on blur/mouse-leave. */
function Tooltip({ label, sub, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      style={{ outline: "none" }}
    >
      {children}
      <span
        role="tooltip"
        className="absolute left-1/2 bottom-[135%] z-40 pointer-events-none transition-all duration-150"
        style={{
          transform: `translateX(-50%) translateY(${show ? "0" : "3px"})`,
          opacity: show ? 1 : 0,
        }}
      >
        <span
          className="block whitespace-nowrap rounded-lg px-3 py-2 text-left"
          style={{ background: C.ink, boxShadow: "0 8px 20px -6px rgba(0,0,0,0.35)" }}
        >
          <span className="block text-[11.5px] font-semibold" style={{ color: "#fff", fontFamily: F }}>
            {label}
          </span>
          {sub && (
            <span className="block text-[10.5px] mt-0.5" style={{ color: "#D4D4D8", fontFamily: F }}>
              {sub}
            </span>
          )}
        </span>
        <span
          className="absolute left-1/2 -translate-x-1/2 top-full -mt-[1px] w-2 h-2 rotate-45"
          style={{ background: C.ink }}
        />
      </span>
    </span>
  );
}

/** iOS-style toggle switch. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-colors duration-200"
      style={{ width: 36, height: 21, background: checked ? C.ink : "#D4D4D8" }}
    >
      <span
        className="absolute top-[2px] rounded-full bg-white shadow transition-transform duration-200"
        style={{ width: 17, height: 17, left: 2, transform: checked ? "translateX(15px)" : "translateX(0)" }}
      />
    </button>
  );
}

/** The "···" kebab menu used throughout the reference screenshots (email row, connected accounts, devices). */
function KebabMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="More options"
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F4F5]"
      >
        <MoreHorizontal size={16} color={C.sub} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-30 w-44 py-1 rounded-xl bg-white overflow-hidden"
          style={{ border: `1px solid ${C.border}`, boxShadow: "0 12px 28px -8px rgba(0,0,0,0.18)" }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                it.onClick();
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-sm transition-colors hover:bg-[#F4F4F5]"
              style={{ color: it.danger ? C.brickDark : C.ink, fontFamily: F, fontWeight: 500 }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The muted "+ Add …" ghost action seen under each list in the reference. */
function GhostAdd({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm mt-2.5 transition-opacity hover:opacity-60"
      style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}
    >
      <Plus size={14} /> {label}
    </button>
  );
}

/**
 * A settings row: bold label in a fixed left column, free-form value/content
 * on the right — the exact layout language of the reference "Profile
 * details" / "Security" panels.
 */
function Row({ label, children, isLast }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-8 py-5"
      style={{ borderBottom: isLast ? "none" : `1px solid ${C.border}` }}
    >
      <div className="sm:w-[158px] shrink-0 text-[14px] font-semibold pt-0.5" style={{ color: C.ink, fontFamily: F }}>
        {label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/** One line inside a row (email / device / etc) with optional trailing kebab menu. */
function RowItem({ left, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/**
 * Inline text field used for quick single-value edits (name, phone,
 * add-email...). Unlike the old version, this ALWAYS validates before
 * calling onSave — validate is required, and Save is disabled (not just
 * silently wrong) until the current draft passes. Errors show inline,
 * the same way Authpage.jsx surfaces its own field errors.
 */
function InlineEditor({ value, placeholder, type = "text", validate, onSave, onCancel, autoFocus = true }) {
  const [draft, setDraft] = useState(value || "");
  const [touched, setTouched] = useState(false);

  const result = useMemo(() => validate(draft), [draft, validate]);
  const showError = touched && draft.trim() !== "" && !result.valid;

  const attemptSave = () => {
    setTouched(true);
    if (!result.valid) return;
    onSave(result.normalized);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          autoFocus={autoFocus}
          type={type}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setTouched(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") attemptSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none border-b pb-1"
          style={{
            color: C.ink,
            fontFamily: F,
            fontWeight: 500,
            borderColor: showError ? C.brick : C.ink,
          }}
        />
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#F4F4F5]"
        >
          <X size={12} color={C.sub} />
        </button>
        <button
          onClick={attemptSave}
          aria-label="Save"
          disabled={draft.trim() !== "" && !result.valid}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-opacity"
          style={{ background: C.ink, opacity: draft.trim() !== "" && !result.valid ? 0.35 : 1 }}
        >
          <Check size={12} color="#fff" />
        </button>
      </div>
      {showError && (
        <p className="text-[11.5px] mt-1.5" style={{ color: C.brickDark, fontFamily: F }}>
          {result.reason}
        </p>
      )}
    </div>
  );
}

/**
 * Profile-photo uploader — separate from the camera-based IdentityCapture
 * below. Lives inside the Profile row's edit mode, right alongside the
 * name field, so updating your photo and your name happen in one place.
 * Picking a file validates type + compresses to the same 400KB JPEG/PNG
 * cap as the identity photo (processPhotoFile handles both).
 */
function ProfilePhotoEditor({ value, onSave, onRemove }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;
    setError("");
    setBusy(true);
    const result = await processPhotoFile(file);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setPreview(result.dataUrl);
  };

  const save = () => {
    if (preview) onSave(preview);
  };

  const remove = () => {
    setPreview(null);
    setError("");
    onRemove?.();
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar photo={preview} initials="" size={56} />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-[#F4F4F5]"
            style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
          >
            {busy ? "Processing…" : preview ? "Change photo" : "Upload photo"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={remove}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: C.brickDark, fontFamily: F, fontWeight: 600 }}
            >
              Remove
            </button>
          )}
          {preview && preview !== value && (
            <button
              type="button"
              onClick={save}
              className="text-xs px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-85"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              Save photo
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={handleFile} className="hidden" />
        {error && (
          <p className="text-[11px]" style={{ color: C.brickDark, fontFamily: F }}>
            {error}
          </p>
        )}
        <p className="text-[10.5px]" style={{ color: C.faint, fontFamily: F }}>
          JPEG or PNG, compressed automatically to stay under 400KB.
        </p>
      </div>
    </div>
  );
}

/**
 * Structured address editor: PIN code first (auto-fetches state + a list of
 * real localities for that PIN via India Post's public API), then State
 * (dropdown of all Indian states/UTs) and City (dropdown, populated from
 * the PIN lookup when available, otherwise from a per-state city list —
 * with "Other" as a manual-entry escape hatch either way, since no static
 * list covers every Indian town). Street stays free text. Country is fixed
 * to India. Replaces the old single free-text "city" input, which is how
 * an address ever ended up saved as an unstructured string like "ufyjcskl".
 */
function AddressEditor({ value, onSave, onCancel }) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const [lookupState, setLookupState] = useState("idle"); // "idle" | "loading" | "done" | "failed"
  const [localities, setLocalities] = useState([]); // from PIN lookup, when available
  const [cityMode, setCityMode] = useState(value.city ? OTHER_CITY : ""); // tracks whether "Other" free-text city is active

  // Auto-fetch state + localities once a full 6-digit PIN is entered.
  useEffect(() => {
    const pin = draft.pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setLookupState("idle");
      setLocalities([]);
      return;
    }
    let cancelled = false;
    setLookupState("loading");
    lookupPincode(pin).then((result) => {
      if (cancelled) return;
      if (result) {
        setLookupState("done");
        setLocalities(result.localities);
        setDraft((d) => ({
          ...d,
          state: result.state && INDIAN_STATES.includes(result.state) ? result.state : d.state,
          // Only auto-fill city if the person hasn't already typed one for this session.
          city: d.city ? d.city : result.localities[0] || d.city,
        }));
      } else {
        setLookupState("failed");
        setLocalities([]);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.pincode]);

  const cityOptions = localities.length > 0 ? localities : (STATE_CITIES[draft.state] || []);

  const checks = {
    pincode: validatePincode(draft.pincode),
    state: draft.state.trim() ? { valid: true } : { valid: false, reason: "Select a state." },
    city: validateRequiredText(draft.city, "City", 2),
    street: validateRequiredText(draft.street, "Street address", 4),
  };
  const allValid = Object.values(checks).every((c) => c.valid);

  return (
    <div className="flex flex-col gap-3.5">
      {/* PIN code first — drives the autofill below */}
      <div>
        <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
          PIN code
        </label>
        <div className="flex items-center gap-2">
          <input
            value={draft.pincode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setDraft((d) => ({ ...d, pincode: v }));
              setTouched(true);
            }}
            inputMode="numeric"
            placeholder="6-digit PIN, e.g. 208001"
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: touched && !checks.pincode.valid ? C.brick : C.ink }}
          />
          {lookupState === "loading" && <Loader2 size={14} color={C.sub} className="animate-spin shrink-0" />}
        </div>
        {touched && !checks.pincode.valid && (
          <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: F }}>{checks.pincode.reason}</p>
        )}
        {lookupState === "done" && (
          <p className="text-[11px] mt-1" style={{ color: "#3F8F5F", fontFamily: F }}>
            State and city filled in from this PIN — check they're right, then adjust if needed.
          </p>
        )}
        {lookupState === "failed" && (
          <p className="text-[11px] mt-1" style={{ color: C.sub, fontFamily: F }}>
            Couldn't look up this PIN automatically — pick state and city manually below.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            State
          </label>
          <select
            value={draft.state}
            onChange={(e) => {
              setDraft((d) => ({ ...d, state: e.target.value, city: "" }));
              setCityMode("");
              setTouched(true);
            }}
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: draft.state ? C.ink : C.faint, fontFamily: F, fontWeight: 500, borderColor: touched && !checks.state.valid ? C.brick : C.ink }}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {touched && !checks.state.valid && (
            <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: F }}>{checks.state.reason}</p>
          )}
        </div>

        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            City
          </label>
          {cityMode !== OTHER_CITY ? (
            <select
              value={cityOptions.includes(draft.city) ? draft.city : ""}
              onChange={(e) => {
                if (e.target.value === OTHER_CITY) {
                  setCityMode(OTHER_CITY);
                  setDraft((d) => ({ ...d, city: "" }));
                } else {
                  setDraft((d) => ({ ...d, city: e.target.value }));
                }
                setTouched(true);
              }}
              disabled={!draft.state && cityOptions.length === 0}
              className="w-full text-sm bg-transparent outline-none border-b pb-1"
              style={{
                color: draft.city ? C.ink : C.faint,
                fontFamily: F,
                fontWeight: 500,
                borderColor: touched && !checks.city.valid ? C.brick : C.ink,
              }}
            >
              <option value="">{draft.state || cityOptions.length ? "Select city" : "Pick a state or PIN first"}</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER_CITY}>Other (type manually)</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft.city}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, city: e.target.value }));
                  setTouched(true);
                }}
                placeholder="Enter city name"
                className="w-full text-sm bg-transparent outline-none border-b pb-1"
                style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: touched && !checks.city.valid ? C.brick : C.ink }}
              />
              {cityOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCityMode("");
                    setDraft((d) => ({ ...d, city: "" }));
                  }}
                  aria-label="Back to city list"
                  className="shrink-0 text-xs transition-opacity hover:opacity-60"
                  style={{ color: C.sub, fontFamily: F }}
                >
                  Use list
                </button>
              )}
            </div>
          )}
          {touched && !checks.city.valid && (
            <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: F }}>{checks.city.reason}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            Street address
          </label>
          <input
            value={draft.street}
            onChange={(e) => {
              setDraft((d) => ({ ...d, street: e.target.value }));
              setTouched(true);
            }}
            placeholder="House no., building, street, area"
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: touched && !checks.street.valid ? C.brick : C.ink }}
          />
          {touched && !checks.street.valid && (
            <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: F }}>{checks.street.reason}</p>
          )}
        </div>
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}>
            Country
          </label>
          <input
            value={draft.country}
            disabled
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: C.faint, fontFamily: F, fontWeight: 500, borderColor: C.border, cursor: "not-allowed" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setTouched(true);
            if (!allValid) return;
            onSave(draft);
          }}
          disabled={touched && !allValid}
          className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
          style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: touched && !allValid ? 0.4 : 1 }}
        >
          Save address
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Local one-time-code panels
   ---------------------------------------------------------------
   Three flows in this file now use the same honest pattern: RaktJaal has
   no backend and no way to actually send an SMS or email, so instead of
   pretending to, each panel generates a 6-digit code, shows it directly
   on screen, and requires the person to type it back before the action
   completes. It's a deliberate confirmation speed bump, not real
   out-of-band verification — the copy says so plainly in each case.
------------------------------------------------------------------ */

/**
 * Account-deletion confirmation using a locally-generated 6-digit code.
 */
function CodeConfirmDelete({ onConfirm, onCancel }) {
  const [code] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [input, setInput] = useState("");
  const matches = input.trim() === code;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
          Type this code to confirm deletion
        </p>
        <p className="text-[12px] mt-1 max-w-sm" style={{ color: C.sub, fontFamily: F }}>
          RaktJaal has no email service yet, so this can't be a real emailed OTP — it's a local confirmation code shown right here, meant only to stop an accidental click.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="px-4 py-2 rounded-lg text-lg tracking-[0.3em] font-bold"
          style={{ background: C.chip, color: C.ink, fontFamily: "monospace" }}
        >
          {code}
        </span>
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        placeholder="Enter the 6-digit code above"
        className="w-full max-w-xs text-sm bg-transparent outline-none border-b pb-1"
        style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: C.ink }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!matches}
          className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
          style={{ background: C.brickDark, fontFamily: F, fontWeight: 600, opacity: matches ? 1 : 0.4 }}
        >
          Confirm delete
        </button>
      </div>
    </div>
  );
}

/**
 * Two-step verification setup. Previously "Add two-step verification"
 * flipped the flag straight to true with no verification step at all, and
 * the enabled state permanently claimed "one-time codes sent to your
 * email" — a claim this app can't back since there's no email backend.
 * Now: a local code is shown, the person has to type it back to enable,
 * and once enabled the row just says "Enabled" — no ongoing claim about
 * how codes get delivered.
 */
function TwoFactorSetup({ onVerified, onCancel }) {
  const [code] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [input, setInput] = useState("");
  const matches = input.trim() === code;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
          Enter this code to confirm two-step verification
        </p>
        <p className="text-[12px] mt-1 max-w-sm" style={{ color: C.sub, fontFamily: F }}>
          RaktJaal has no email service yet, so this can't be a real emailed code — it's shown right here as a stand-in confirmation step.
        </p>
      </div>
      <span
        className="px-4 py-2 rounded-lg text-lg tracking-[0.3em] font-bold w-fit"
        style={{ background: C.chip, color: C.ink, fontFamily: "monospace" }}
      >
        {code}
      </span>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        placeholder="Enter the 6-digit code above"
        className="w-full max-w-xs text-sm bg-transparent outline-none border-b pb-1"
        style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: C.ink }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Cancel
        </button>
        <button
          onClick={onVerified}
          disabled={!matches}
          className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
          style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: matches ? 1 : 0.4 }}
        >
          Verify & enable
        </button>
      </div>
    </div>
  );
}

/**
 * Phone number OTP verification. Shown right after saving a new phone
 * number in the Contact details row — the number isn't actually stored as
 * the profile's phone until this code is confirmed. Same honesty pattern
 * as above: local code, shown on screen, no real SMS. Once a given number
 * has been verified this way, ProfilePage remembers it (`verifiedPhone`)
 * so re-saving the *same* number later skips straight through — this step
 * only fires for a number that hasn't been verified before.
 */
function PhoneOtpVerify({ phone, onVerified, onCancel }) {
  const [code] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [input, setInput] = useState("");
  const matches = input.trim() === code;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
          Enter the code to verify {phone}
        </p>
        <p className="text-[12px] mt-1 max-w-sm" style={{ color: C.sub, fontFamily: F }}>
          RaktJaal has no SMS service yet, so this can't be a real text message — it's a local confirmation code shown right here. This is a one-time check for this number; once verified you won't be asked again unless you change it.
        </p>
      </div>
      <span
        className="px-4 py-2 rounded-lg text-lg tracking-[0.3em] font-bold w-fit"
        style={{ background: C.chip, color: C.ink, fontFamily: "monospace" }}
      >
        {code}
      </span>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        placeholder="Enter the 6-digit code above"
        className="w-full max-w-xs text-sm bg-transparent outline-none border-b pb-1"
        style={{ color: C.ink, fontFamily: F, fontWeight: 500, borderColor: C.ink }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
          style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
        >
          Cancel
        </button>
        <button
          onClick={onVerified}
          disabled={!matches}
          className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
          style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: matches ? 1 : 0.4 }}
        >
          Verify number
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Donation history
------------------------------------------------------------------ */
/**
 * Blood type is safety-critical, so unlike other profile fields it isn't
 * casually re-editable after the first save. Once set, it shows locked
 * with an explicit "Request change" path that requires a second confirm
 * click — a deliberate speed bump against fat-fingering a life-or-death
 * field, not a technical lock (there's no backend to enforce one).
 */
function BloodTypePicker({ value, onSave }) {
  const [pendingChange, setPendingChange] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (value && !pendingChange) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Droplet size={13} color={C.sub} />
          <span className="text-sm" style={{ color: C.sub, fontFamily: F }}>Blood type</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="px-4 py-1.5 rounded-full text-sm inline-flex items-center gap-1.5"
            style={{ background: C.brick, color: "#fff", fontFamily: F, fontWeight: 700, boxShadow: "0 2px 8px -2px rgba(214,48,63,0.5)" }}
          >
            <Lock size={11} /> {value}
          </span>
          <button
            onClick={() => {
              setDraft(value);
              setPendingChange(true);
            }}
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: C.sub, fontFamily: F, fontWeight: 600 }}
          >
            Request change
          </button>
        </div>
        <p className="text-[11px] mt-2 max-w-sm" style={{ color: C.faint, fontFamily: F }}>
          Locked after first save since it's safety-critical for matching. You can still change it if it was entered wrong — that just needs a second confirmation.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Droplet size={13} color={C.sub} />
        <span className="text-sm" style={{ color: C.sub, fontFamily: F }}>Blood type</span>
        {!value && (
          <span className="text-xs italic" style={{ color: C.faint, fontFamily: F }}>— not selected</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BLOOD_TYPES.map((bt) => {
          const active = draft === bt;
          return (
            <button
              key={bt}
              onClick={() => setDraft(bt)}
              className="px-3.5 py-1.5 rounded-full text-xs transition-all active:scale-95"
              style={{
                background: active ? C.brick : C.chip,
                color: active ? "#fff" : C.ink,
                fontFamily: F,
                fontWeight: 700,
                boxShadow: active ? "0 2px 8px -2px rgba(214,48,63,0.5)" : "none",
              }}
            >
              {bt}
            </button>
          );
        })}
      </div>
      {draft && (
        <div className="flex items-center gap-2 mt-3">
          {pendingChange && (
            <button
              onClick={() => setPendingChange(false)}
              className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
              style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => {
              onSave(draft);
              setPendingChange(false);
            }}
            className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity hover:opacity-85"
            style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}
          >
            {value ? `Confirm change to ${draft}` : `Save ${draft}   can't be changed casually later`}
          </button>
        </div>
      )}
    </div>
  );
}

function DonationHistory({ donations }) {
  if (!donations || donations.length === 0) {
    return (
      <div className="rounded-xl p-5 text-center" style={{ background: C.hover, border: `1px dashed ${C.border}` }}>
        <p className="text-sm" style={{ color: C.sub, fontFamily: F }}>
          No donations yet. Once you donate through RaktJaal, it'll show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {donations.map((d, i) => (
        <div key={i} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ background: C.hover }}>
          <div>
            <div className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
              {d.location || "Location not recorded"}
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: F }}>
              {d.date}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs text-white" style={{ background: C.brick, fontFamily: F, fontWeight: 600 }}>
            {d.units ? `${d.units} unit${d.units > 1 ? "s" : ""}` : "1 unit"}
          </span>
        </div>
      ))}
    </div>
  );
}

function nextEligibleText(donations) {
  if (!donations || donations.length === 0) return "You're eligible to donate right now.";
  const last = donations[donations.length - 1];
  if (!last?.date) return "You're eligible to donate right now.";
  const lastDate = new Date(last.date);
  if (isNaN(lastDate.getTime())) return "You're eligible to donate right now.";
  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + 90);
  if (nextDate <= new Date()) return "You're eligible to donate right now.";
  return `Eligible again from ${nextDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`;
}

/* ---------------------------------------------------------------
   Dialog chrome — flat dark scrim + plain white squircle card,
   exactly the two-layer look of the reference screenshots (dimmed
   app behind, crisp panel in front). No gradients, no brand tint.
------------------------------------------------------------------ */
/**
 * Camera-based identity capture. Important honesty note baked into the UI
 * copy itself: this captures a photo into the browser's local storage only.
 * There is no backend, no human review, and no verification actually
 * happening — so this deliberately does NOT claim to "verify" anyone or
 * promise it helps "in case anything happens." It's labeled as what it is:
 * a locally-stored photo attached to the profile, useful only once a real
 * moderation/verification backend exists to do something with it.
 */
function IdentityCapture({ hasPhoto, onSave, onRemove, onAlsoSetProfilePhoto }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // "idle" | "requesting" | "live" | "denied" | "captured"
  const [captured, setCaptured] = useState(null);
  const [useAsProfilePhoto, setUseAsProfilePhoto] = useState(true);
  const [captureError, setCaptureError] = useState("");
  // The video element can report phase "live" before it has actually
  // decoded a frame — capturing before that produces an all-black photo.
  // videoReady only flips true once a real frame has arrived.
  const [videoReady, setVideoReady] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopStream, []); // cleanup on unmount

  const startCamera = async () => {
    setPhase("requesting");
    setCaptureError("");
    setVideoReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setPhase("live");
      // videoRef isn't mounted until phase flips to "live" and this re-renders;
      // attach on next tick.
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setPhase("denied");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    // Guard against capturing before a real frame has decoded — this is
    // exactly what used to produce an all-black saved photo.
    if (!video || !videoReady || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCaptureError("Camera isn't ready yet — give it a second and try again.");
      return;
    }
    const constrained = drawToConstrainedDataUrl(video, video.videoWidth, video.videoHeight);
    if (!constrained) {
      setCaptureError("Couldn't process this photo — try again.");
      return;
    }
    setCaptured(constrained);
    stopStream();
    setPhase("captured");
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  /** Back out of the live camera view entirely — stop the stream, no photo taken. */
  const cancelLive = () => {
    stopStream();
    setVideoReady(false);
    setCaptureError("");
    setPhase("idle");
  };

  /** Discard a just-captured photo without saving it. */
  const cancelCaptured = () => {
    setCaptured(null);
    setCaptureError("");
    setUseAsProfilePhoto(true);
    setPhase("idle");
  };

  const confirmSave = () => {
    onSave(captured);
    if (useAsProfilePhoto) onAlsoSetProfilePhoto?.(captured);
    setPhase("idle");
    setCaptured(null);
  };

  if (hasPhoto && phase === "idle") {
    return (
      <RowItem
        left={
          <div className="flex items-center gap-2">
            <Camera size={14} color={C.sub} />
            <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
              Photo saved to this device
            </span>
          </div>
        }
        right={<KebabMenu items={[{ label: "Remove photo", danger: true, onClick: onRemove }, { label: "Retake", onClick: startCamera }]} />}
      />
    );
  }

  return (
    <div>
      {phase === "idle" && (
        <GhostAdd label="Add a photo" onClick={startCamera} />
      )}
      {phase === "requesting" && (
        <p className="text-sm" style={{ color: C.sub, fontFamily: F }}>Requesting camera access…</p>
      )}
      {phase === "live" && (
        <div className="flex flex-col gap-2.5">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setVideoReady(true)}
            className="w-full max-w-xs rounded-xl"
            style={{ background: "#000" }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={capture}
              disabled={!videoReady}
              className="self-start text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600, opacity: videoReady ? 1 : 0.45, cursor: videoReady ? "pointer" : "default" }}
            >
              {videoReady ? "Capture" : "Starting camera…"}
            </button>
            <button
              onClick={cancelLive}
              className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
              style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              Cancel
            </button>
          </div>
          {captureError && (
            <p className="text-[11.5px]" style={{ color: C.brickDark, fontFamily: F }}>{captureError}</p>
          )}
        </div>
      )}
      {phase === "captured" && captured && (
        <div className="flex flex-col gap-2.5">
          <img src={captured} alt="Captured preview" className="w-full max-w-xs rounded-xl" />
          <label className="flex items-center gap-2 text-xs" style={{ color: C.sub, fontFamily: F }}>
            <input
              type="checkbox"
              checked={useAsProfilePhoto}
              onChange={(e) => setUseAsProfilePhoto(e.target.checked)}
            />
            Also use this as my profile photo
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelCaptured}
              className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
              style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={retake}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F4F5]"
              style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              <RotateCcw size={12} /> Retake
            </button>
            <button
              onClick={confirmSave}
              className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity hover:opacity-85"
              style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}
            >
              Save photo
            </button>
          </div>
        </div>
      )}
      {phase === "denied" && (
        <div>
          <p className="text-sm" style={{ color: C.brickDark, fontFamily: F }}>
            Camera access was blocked or unavailable.
          </p>
          <button onClick={startCamera} className="text-xs mt-1.5 transition-opacity hover:opacity-60" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
            Try again
          </button>
        </div>
      )}
      <p className="text-[11px] mt-2.5 max-w-sm" style={{ color: C.faint, fontFamily: F }}>
        This photo is stored only on this device — there's no backend yet to review, verify, or share it. It isn't identity verification, just a local record attached to your profile. Compressed automatically to stay under 400KB.
      </p>
    </div>
  );
}

/** Decorative animated backdrop behind the dialog card — soft drifting
 *  gradient blobs plus a faint dot-grid, meant to read as illustrated
 *  digital art rather than a literal photo or video. Purely visual:
 *  fixed, pointer-events disabled, sits behind the card via z-index. */
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full"
        style={{
          width: 520,
          height: 520,
          top: "-12%",
          left: "-8%",
          background: "radial-gradient(circle at 30% 30%, rgba(214,48,63,0.35), transparent 70%)",
          filter: "blur(60px)",
          animation: "drift1 16s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 460,
          height: 460,
          bottom: "-14%",
          right: "-6%",
          background: "radial-gradient(circle at 60% 40%, rgba(120,110,255,0.28), transparent 70%)",
          filter: "blur(70px)",
          animation: "drift2 20s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 380,
          height: 380,
          top: "30%",
          right: "18%",
          background: "radial-gradient(circle at 50% 50%, rgba(253,226,228,0.22), transparent 70%)",
          filter: "blur(50px)",
          animation: "drift3 24s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
    </div>
  );
}

function DialogShell({ onClose, children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-10 relative" style={{ background: "#171717" }}>
      <style>{FONT_IMPORT}</style>
      <AmbientBackground />
      <div
        className="relative w-full max-w-[900px] overflow-hidden flex flex-col sm:flex-row"
        style={{ background: C.paper, borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)", minHeight: 560, zIndex: 1 }}
      >
        {children}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F4F5] z-10"
        >
          <X size={17} color={C.sub} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Signed-out state — same dialog language
------------------------------------------------------------------ */
function SignedOut() {
  const navigate = useNavigate();
  return (
    <DialogShell onClose={() => navigate("/")}>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-10 py-16">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: C.blush }}>
          <Droplet size={22} color={C.brick} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: C.ink, fontFamily: F }}>
          You're not signed in
        </h1>
        <p className="text-sm mb-7" style={{ color: C.sub, fontFamily: F }}>
          Create an account or log in to see your donor profile.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate("/register")}
            className="px-5 py-2.5 rounded-full text-sm text-white transition-transform hover:scale-[1.04] active:scale-95"
            style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}
          >
            Create account
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2.5 rounded-full text-sm transition-colors hover:bg-[#F4F4F5]"
            style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: F, fontWeight: 600 }}
          >
            Log in
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------
   Main page
------------------------------------------------------------------ */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser());
  const [tab, setTab] = useState("profile"); // "profile" | "security"
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingKey, setEditingKey] = useState(null); // "name" | "email" | "phone" | "address" | "addEmail"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingUpTwoFactor, setSettingUpTwoFactor] = useState(false);
  const [pendingPhone, setPendingPhone] = useState(null); // phone number awaiting OTP confirmation
  const device = useMemo(() => readDeviceInfo(), []);
  const [sessionStart] = useState(() => new Date());

  if (!user) return <SignedOut />;

  const missing = missingFields(user);
  const address = normalizeAddress(user);

  const flashSaved = () => {
    setSavedFlash(true);
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(() => setSavedFlash(false), 1500);
  };

  const updateField = (key, value) => {
    const updated = { ...user, [key]: value };
    saveCurrentUser({ [key]: value });
    setUser(updated);
    flashSaved();
  };

  // Same as updateField but for saving several fields together in one go —
  // used by phone verification, which needs to set phone + phoneVerified +
  // verifiedPhone atomically rather than as three separate renders.
  const updateFields = (patch) => {
    const updated = { ...user, ...patch };
    saveCurrentUser(patch);
    setUser(updated);
    flashSaved();
  };

  const saveAddress = (addr) => {
    updateField("address", addr);
    setEditingKey(null);
  };

  const addSecondaryEmail = (email) => {
    if (!email) {
      setEditingKey(null);
      return;
    }
    // Defensive backstop — the InlineEditor's validate() below already
    // blocks duplicates before onSave ever fires, but this keeps the
    // function safe to call from anywhere.
    if (isDuplicateEmail(email, user)) {
      setEditingKey(null);
      return;
    }
    const list = Array.isArray(user.secondaryEmails) ? user.secondaryEmails : [];
    updateField("secondaryEmails", [...list, email]);
    setEditingKey(null);
  };

  const removeSecondaryEmail = (email) => {
    const list = Array.isArray(user.secondaryEmails) ? user.secondaryEmails : [];
    updateField("secondaryEmails", list.filter((e) => e !== email));
  };

  const jumpToMissing = () => {
    setTab("profile");
    if (missing[0]) setEditingKey(missing[0].key);
  };

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    try {
      const raw = localStorage.getItem(DIRECTORY_KEY);
      const dir = raw ? JSON.parse(raw) : {};
      delete dir[(user.email || "").toLowerCase()];
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
    } catch {
      /* best-effort — session clear below still logs them out either way */
    }
    clearCurrentUser();
    navigate("/register");
  };

  const displayName = user.name?.trim() || "Unnamed donor";
  const initials = user.name?.trim()
    ? user.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
    : "?";
  const secondaryEmails = Array.isArray(user.secondaryEmails) ? user.secondaryEmails : [];
  const phoneIsVerified = Boolean(user.phone && user.phoneVerified && user.verifiedPhone === user.phone);

  const NAV = [
    { key: "profile", label: "Profile", icon: User },
    { key: "security", label: "Security", icon: KeyRound },
  ];

  return (
    <DialogShell onClose={() => navigate("/")}>
      {/* saved toast */}
      <div
        className="fixed top-5 right-5 z-50 transition-all duration-300"
        style={{ opacity: savedFlash ? 1 : 0, transform: savedFlash ? "translateY(0)" : "translateY(-8px)", pointerEvents: "none" }}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-white text-xs" style={{ background: C.ink, fontFamily: F, fontWeight: 600 }}>
          <Check size={13} /> Saved
        </div>
      </div>

      {/* ---- left: Account sidebar ---- */}
      <aside
        className="sm:w-[240px] shrink-0 px-7 py-8 flex flex-col justify-between"
        style={{ borderRight: `1px solid ${C.border}`, background: C.sidebar }}
      >
        <div>
          <h1 className="text-[21px] font-bold tracking-tight mb-1" style={{ color: C.ink, fontFamily: F }}>
            Account
          </h1>
          <p className="text-[13px] mb-6" style={{ color: C.sub, fontFamily: F }}>
            Manage your account info.
          </p>
          <nav className="flex sm:flex-col gap-1">
            {NAV.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg transition-colors text-left"
                  style={{
                    background: active ? C.chip : "transparent",
                    color: active ? C.ink : C.sub,
                    fontFamily: F,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* quick identity + logout, tucked at the bottom of the sidebar */}
        <div className="hidden sm:flex items-center gap-2.5 pt-6 mt-6" style={{ borderTop: `1px solid ${C.border}` }}>
          <Avatar photo={user.profilePhoto} initials={initials} size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>
              {displayName}
            </div>
            <div className="text-[11px] truncate" style={{ color: C.sub, fontFamily: F }}>
              {user.email}
            </div>
          </div>
          <button onClick={handleLogout} aria-label="Log out" className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[#EFEFEF]">
            <LogOut size={13} color={C.sub} />
          </button>
        </div>
      </aside>

      {/* ---- right: content panel ---- */}
      <section
        className="flex-1 min-w-0 px-8 py-8 sm:px-10 sm:py-9 overflow-y-auto overflow-x-hidden rk-scroll rounded-b-[22px] sm:rounded-bl-none sm:rounded-tr-[22px] sm:rounded-br-[22px]"
        style={{ maxHeight: "90vh" }}
      >
        {tab === "profile" ? (
          <>
            <h2 className="text-[20px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>
              Profile details
            </h2>
            <p className="text-[13px] mt-1 mb-2" style={{ color: C.sub, fontFamily: F }}>
              This is how other donors and requesters see you.
            </p>

            {missing.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-4 my-4" style={{ background: "#FFF8ED", border: "1px solid #FBE4C0" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "#FCEAD1" }}>
                  <AlertCircle size={14} color="#9A5B0A" />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[13px]" style={{ color: C.ink, fontFamily: F, fontWeight: 700 }}>
                    Your profile is missing {missing.length} detail{missing.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "#8A6A3D", fontFamily: F }}>
                    {missing.map((f) => f.label).join(", ")} — complete profiles get matched faster.
                  </p>
                </div>
                <button
                  onClick={jumpToMissing}
                  className="shrink-0 flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-85"
                  style={{ background: C.ink, fontFamily: F, fontWeight: 700 }}
                >
                  <Plus size={11} /> Complete
                </button>
              </div>
            )}

            <div className="mt-2">
              {/* Profile row: avatar + name + "Update profile" */}
              <Row label="Profile">
                {editingKey !== "name" ? (
                  <RowItem
                    left={
                      <div className="flex items-center gap-3">
                        <Avatar photo={user.profilePhoto} initials={initials} size={40} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate" style={{ color: C.ink, fontFamily: F }}>
                              {displayName}
                            </span>
                            {user.verified && (
                              <Tooltip label="Verified donor" sub="Identity confirmed by RaktJaal">
                                <ShieldCheck size={14} color={C.brick} className="cursor-default" />
                              </Tooltip>
                            )}
                          </div>
                          {!user.name?.trim() && (
                            <span className="text-xs italic" style={{ color: C.sub, fontFamily: F }}>
                              Not added yet
                            </span>
                          )}
                        </div>
                      </div>
                    }
                    right={
                      <button onClick={() => setEditingKey("name")} className="text-sm transition-opacity hover:opacity-60" style={{ color: C.ink, fontFamily: F, fontWeight: 600 }}>
                        Update profile
                      </button>
                    }
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <ProfilePhotoEditor
                      value={user.profilePhoto}
                      onSave={(dataUrl) => updateField("profilePhoto", dataUrl)}
                      onRemove={() => updateField("profilePhoto", null)}
                    />
                    <InlineEditor
                      value={user.name}
                      placeholder="Your full name"
                      validate={(v) => validateName(v)}
                      onSave={(v) => {
                        updateField("name", v);
                        setEditingKey(null);
                      }}
                      onCancel={() => setEditingKey(null)}
                    />
                  </div>
                )}
              </Row>

              {/* Email addresses row */}
              <Row label="Email addresses">
                <div className="flex flex-col gap-2.5">
                  {editingKey !== "email" ? (
                    <RowItem
                      left={
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm truncate" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                            {user.email}
                          </span>
                          <Pill>Primary</Pill>
                        </div>
                      }
                      right={<KebabMenu items={[{ label: "Edit primary email", onClick: () => setEditingKey("email") }]} />}
                    />
                  ) : (
                    <InlineEditor
                      value={user.email}
                      type="email"
                      placeholder="name@example.com"
                      validate={(v) => {
                        const base = validateEmail(v);
                        if (!base.valid) return base;
                        // Block saving the primary email as a value that's
                        // already sitting in the secondary list.
                        if (isDuplicateEmail(base.normalized, user, { excludePrimary: true })) {
                          return { valid: false, reason: "That email is already saved as a secondary address.", normalized: base.normalized };
                        }
                        return base;
                      }}
                      onSave={(v) => {
                        updateField("email", v);
                        setEditingKey(null);
                      }}
                      onCancel={() => setEditingKey(null)}
                    />
                  )}
                  {secondaryEmails.map((email) => (
                    <RowItem
                      key={email}
                      left={
                        <span className="text-sm truncate" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                          {email}
                        </span>
                      }
                      right={<KebabMenu items={[{ label: "Remove", danger: true, onClick: () => removeSecondaryEmail(email) }]} />}
                    />
                  ))}
                </div>
                {editingKey === "addEmail" ? (
                  <div className="mt-2.5">
                    <InlineEditor
                      value=""
                      type="email"
                      placeholder="name@example.com"
                      validate={(v) => {
                        const base = validateEmail(v);
                        if (!base.valid) return base;
                        // The actual fix: check the candidate against BOTH
                        // the primary email and the existing secondary list,
                        // not just the secondary list — this is what let the
                        // same address be entered as primary and secondary.
                        if (isDuplicateEmail(base.normalized, user)) {
                          return { valid: false, reason: "That email is already on this account.", normalized: base.normalized };
                        }
                        return base;
                      }}
                      onSave={addSecondaryEmail}
                      onCancel={() => setEditingKey(null)}
                    />
                  </div>
                ) : (
                  <GhostAdd label="Add email address" onClick={() => setEditingKey("addEmail")} />
                )}
              </Row>

              {/* Contact details row */}
              <Row label="Contact details">
                <div className="flex flex-col gap-3.5">
                  <div>
                    {editingKey === "phone" ? (
                      pendingPhone ? (
                        <PhoneOtpVerify
                          phone={pendingPhone}
                          onVerified={() => {
                            updateFields({ phone: pendingPhone, phoneVerified: true, verifiedPhone: pendingPhone });
                            setPendingPhone(null);
                            setEditingKey(null);
                          }}
                          onCancel={() => {
                            setPendingPhone(null);
                            setEditingKey(null);
                          }}
                        />
                      ) : (
                        <InlineEditor
                          value={user.phone}
                          type="tel"
                          placeholder="+91 98765 43210"
                          validate={(v) => validatePhone(v)}
                          onSave={(v) => {
                            // Already verified this exact number before —
                            // this is the "one-time" part: skip OTP entirely.
                            if (v === user.verifiedPhone && user.phoneVerified) {
                              updateField("phone", v);
                              setEditingKey(null);
                              return;
                            }
                            // New or previously-unverified number — hold off
                            // on saving it as the real phone until OTP passes.
                            setPendingPhone(v);
                          }}
                          onCancel={() => setEditingKey(null)}
                        />
                      )
                    ) : (
                      <RowItem
                        left={
                          <div className="flex items-center gap-2">
                            <Phone size={13} color={C.sub} />
                            {user.phone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                                  {user.phone}
                                </span>
                                {phoneIsVerified && (
                                  <Tooltip label="Phone verified" sub="Confirmed via one-time code">
                                    <ShieldCheck size={13} color={C.brick} className="cursor-default" />
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm italic" style={{ color: C.sub, fontFamily: F }}>
                                No phone number
                              </span>
                            )}
                          </div>
                        }
                        right={<KebabMenu items={[{ label: "Edit phone number", onClick: () => setEditingKey("phone") }]} />}
                      />
                    )}
                  </div>
                  <div>
                    {editingKey !== "address" ? (
                      <RowItem
                        left={
                          <div className="flex items-start gap-2">
                            <Home size={13} color={C.sub} className="mt-0.5 shrink-0" />
                            {addressIsComplete(address) ? (
                              <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                                {formatAddress(address)}
                              </span>
                            ) : (
                              <span className="text-sm italic" style={{ color: C.sub, fontFamily: F }}>
                                No address added
                              </span>
                            )}
                          </div>
                        }
                        right={<KebabMenu items={[{ label: "Edit address", onClick: () => setEditingKey("address") }]} />}
                      />
                    ) : (
                      <AddressEditor value={address} onSave={saveAddress} onCancel={() => setEditingKey(null)} />
                    )}
                  </div>
                </div>
              </Row>

              {/* Donor details row */}
              <Row label="Donor details">
                <div className="flex flex-col gap-4">
                  <BloodTypePicker value={user.bloodType} onSave={(bt) => updateField("bloodType", bt)} />

                  <RowItem
                    left={
                      <div className="flex items-center gap-2">
                        <HeartHandshake size={13} color={C.sub} />
                        <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                          Available to donate
                        </span>
                      </div>
                    }
                    right={<Toggle checked={user.available !== false} onChange={(v) => updateField("available", v)} label="Available to donate" />}
                  />
                  <RowItem
                    left={
                      <div className="flex items-center gap-2">
                        <Bell size={13} color={C.sub} />
                        <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                          Urgent request alerts
                        </span>
                      </div>
                    }
                    right={<Toggle checked={user.alertsEnabled !== false} onChange={(v) => updateField("alertsEnabled", v)} label="Urgent request alerts" />}
                  />
                </div>
              </Row>

              {/* Donation history row */}
              <Row label="Donation history" isLast>
                <p className="text-xs mb-2.5" style={{ color: C.sub, fontFamily: F }}>
                  {nextEligibleText(user.donations)}
                </p>
                <DonationHistory donations={user.donations} />
              </Row>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-bold tracking-tight" style={{ color: C.ink, fontFamily: F }}>
              Security
            </h2>
            <p className="text-[13px] mt-1 mb-2" style={{ color: C.sub, fontFamily: F }}>
              Manage sign-in and device access.
            </p>

            <div className="mt-2">
              {/* Two-step verification */}
              <Row label="Two-step verification">
                {user.twoFactorEnabled ? (
                  <RowItem
                    left={
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} color={C.brick} />
                        <span className="text-sm" style={{ color: C.ink, fontFamily: F, fontWeight: 500 }}>
                          Enabled
                        </span>
                      </div>
                    }
                    right={<KebabMenu items={[{ label: "Turn off", danger: true, onClick: () => updateField("twoFactorEnabled", false) }]} />}
                  />
                ) : settingUpTwoFactor ? (
                  <TwoFactorSetup
                    onVerified={() => {
                      updateField("twoFactorEnabled", true);
                      setSettingUpTwoFactor(false);
                    }}
                    onCancel={() => setSettingUpTwoFactor(false)}
                  />
                ) : (
                  <GhostAdd label="Add two-step verification" onClick={() => setSettingUpTwoFactor(true)} />
                )}
              </Row>

              {/* Active devices */}
              <Row label="Active devices">
                <RowItem
                  left={
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: C.ink }}>
                        {device.isMobile ? <Smartphone size={15} color="#fff" /> : <Laptop size={15} color="#fff" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: F }}>
                            {device.os}
                          </span>
                          <Pill>This device</Pill>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: F }}>
                          {device.browser}
                        </div>
                        <div className="text-xs" style={{ color: C.sub, fontFamily: F }}>
                          Signed in {sessionStart.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} today
                        </div>
                      </div>
                    </div>
                  }
                  right={<KebabMenu items={[{ label: "Sign out", danger: true, onClick: handleLogout }]} />}
                />
              </Row>

              {/* Identity photo */}
              <Row label="Identity photo">
                <IdentityCapture
                  hasPhoto={Boolean(user.identityPhoto)}
                  onSave={(dataUrl) => updateField("identityPhoto", dataUrl)}
                  onRemove={() => updateField("identityPhoto", null)}
                  onAlsoSetProfilePhoto={(dataUrl) => updateField("profilePhoto", dataUrl)}
                />
              </Row>

              {/* Danger zone */}
              <Row label="Delete account" isLast>
                {!confirmDelete ? (
                  <RowItem
                    left={
                      <span className="text-sm" style={{ color: C.sub, fontFamily: F }}>
                        Permanently remove your profile and donation history. This can't be undone.
                      </span>
                    }
                    right={
                      <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-60" style={{ color: C.brickDark, fontFamily: F, fontWeight: 600 }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    }
                  />
                ) : (
                  <CodeConfirmDelete onConfirm={handleDeleteAccount} onCancel={() => setConfirmDelete(false)} />
                )}
              </Row>
            </div>
          </>
        )}
      </section>
    </DialogShell>
  );
}