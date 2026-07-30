import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  MapPin,
  Droplet,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  X,
  CalendarDays,
  Loader2
} from "lucide-react";
import { registerUser, loginUser } from "./Authstore";

const C = {
  ink: "#14110F",
  paper: "#FFFFFF",
  sub: "#66605A",
  brick: "#D6303F",
  brickDark: "#B21F2D",
  blush: "#FDE2E4",
  peach: "#FFE8D2",
  lilac: "#E7E1FF",
  mint: "#DEF5E4",
  sky: "#DCEEFF",
};

const FD = "'Plus Jakarta Sans', sans-serif";
const FB = "'Manrope', sans-serif";
const FM = "'JetBrains Mono', monospace";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-14px); } }
@keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.6; } 70% { transform: scale(1.6); opacity: 0; } 100% { opacity: 0; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dash { to { stroke-dashoffset: 0; } }
@keyframes cardIn { from { opacity: 0; transform: translateY(18px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shake { 10%,90% { transform: translateX(-1px); } 20%,80% { transform: translateX(2px); } 30%,50%,70% { transform: translateX(-4px); } 40%,60% { transform: translateX(4px); } }
`;

/* Real, common inbox providers — extend this list if you need more. */
const VALID_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "protonmail.com",
  "icloud.com",
  "live.com",
];

function validateEmail(email) {
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim());
  if (!match) return { valid: false, reason: "Enter a full email address, like name@gmail.com" };
  const domain = match[1].toLowerCase();
  if (!domain.endsWith(".com")) return { valid: false, reason: "Email must end in .com" };
  if (!VALID_DOMAINS.includes(domain)) {
    return { valid: false, reason: `Use a real provider — ${VALID_DOMAINS.slice(0, 4).join(", ")}, etc.` };
  }
  return { valid: true, reason: "" };
}

function passwordChecks(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function BrandMark({ size = 32, ring = false }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ring && <span className="absolute inset-0 rounded-full" style={{ background: C.brick, animation: "pulseRing 2.4s ease-out infinite" }} />}
      <svg width={size} height={size} viewBox="0 0 40 40" className="relative">
        <path d="M20 3 C28 15 34 24 34 30 C34 36 27.7 40 20 40 C12.3 40 6 36 6 30 C6 24 12 15 20 3 Z" fill={C.brick} />
        <rect x="17" y="18" width="6" height="16" rx="1.5" fill="#fff" />
        <rect x="12" y="23" width="16" height="6" rx="1.5" fill="#fff" />
      </svg>
    </div>
  );
}

/* ---------------- Fields ---------------- */

function Field({ icon: Icon, error, ...props }) {
  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white transition-all duration-200"
        style={{ border: `1.5px solid ${error ? C.brick : `${C.ink}22`}` }}
      >
        <Icon size={17} style={{ color: error ? C.brick : C.sub }} className="shrink-0" />
        <input
          {...props}
          className="w-full bg-transparent text-sm outline-none placeholder-gray-400"
          style={{ fontFamily: FB, color: C.ink }}
        />
      </div>
      {error && (
        <p className="text-xs mt-1.5 ml-1" style={{ color: C.brick, fontFamily: FB, animation: "fadeUp 0.25s ease" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordField({ value, onChange, placeholder = "Password", showRules = false }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const checks = passwordChecks(value);
  const allGood = checks.length && checks.upper && checks.number && checks.symbol;

  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white transition-all duration-200"
        style={{ border: `1.5px solid ${value && !allGood && !focused ? C.brick : `${C.ink}22`}` }}
      >
        <Lock size={17} style={{ color: C.sub }} className="shrink-0" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder-gray-400"
          style={{ fontFamily: FB, color: C.ink }}
        />
        <button type="button" onClick={() => setShow((s) => !s)} style={{ color: C.sub }} className="shrink-0">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {showRules && (focused || value) && (
        <div
          className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 px-1"
          style={{ animation: "fadeUp 0.25s ease" }}
        >
          {[
            [checks.length, "8+ characters"],
            [checks.upper, "One capital letter"],
            [checks.number, "One number"],
            [checks.symbol, "One symbol"],
          ].map(([ok, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              {ok ? <Check size={12} color="#1F6B3A" /> : <X size={12} color={`${C.ink}55`} />}
              <span className="text-[11px]" style={{ color: ok ? "#1F6B3A" : C.sub, fontFamily: FB }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Google sign-in ---------------- */

function GoogleGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={{ overflow: "visible" }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function GoogleButton({ label = "Sign in with Google" }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(false);

  const handleGoogleAuth = async () => {
    setPending(true);
    await new Promise((r) => setTimeout(r, 500)); 
    setPending(false);
    setNotice(true);
    setTimeout(() => setNotice(false), 3200);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={pending}
        className="relative w-full flex items-center justify-center py-3 rounded-2xl text-[15px] font-bold bg-white transition-all duration-200 hover:bg-[#F9F9F8] active:scale-[0.98] disabled:opacity-60"
        style={{ border: `1.5px solid ${C.ink}1A`, fontFamily: FB, color: C.ink }}
      >
        <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {pending ? (
            <span className="w-[18px] h-[18px] rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.ink}33`, borderTopColor: "transparent" }} />
          ) : (
            <GoogleGlyph />
          )}
        </span>
        {label}
      </button>
      {notice && (
        <p
          className="text-xs text-center mt-2.5"
          style={{ color: C.sub, fontFamily: FB, animation: "fadeUp 0.25s ease" }}
        >
          Google sign-in isn't connected yet — coming soon.
        </p>
      )}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <span className="flex-1 h-px" style={{ background: `${C.ink}14` }} />
      <span className="text-xs" style={{ color: C.sub, fontFamily: FB }}>or</span>
      <span className="flex-1 h-px" style={{ background: `${C.ink}14` }} />
    </div>
  );
}

function VitalsLine() {
  return (
    <svg viewBox="0 0 300 40" className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points="0,20 45,20 56,8 67,32 78,20 120,20 131,10 142,30 153,20 300,20"
        fill="none" stroke={C.brick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 520, strokeDashoffset: 520, animation: "dash 3s ease-in-out infinite" }}
      />
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between w-1/2 min-h-screen p-12 overflow-hidden" style={{ background: C.ink }}>
      <div
        className="absolute -top-24 -left-24 w-[420px] h-[420px] opacity-[0.14]"
        style={{ background: C.brick, borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%", animation: "float 8s ease-in-out infinite" }}
      />
      <div
        className="absolute bottom-[-140px] right-[-100px] w-[320px] h-[320px] opacity-[0.08]"
        style={{ background: C.sky, borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%", animation: "float 10s ease-in-out infinite reverse" }}
      />

      <Link to="/" className="relative flex items-center gap-2 z-10">
        <BrandMark size={28} />
        <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: FD }}>RaktJaal</span>
      </Link>

      <div className="relative z-10">
        <p className="text-xs uppercase tracking-wider mb-4" style={{ color: C.blush, fontFamily: FM }}>Why this matters</p>
        <h2 className="text-4xl font-medium leading-[1.1] tracking-tight mb-8" style={{ color: "#fff", fontFamily: FD }}>
          Every drop finds
          <br />
          somewhere to go —
          <br />
          <span style={{ color: C.brick }}>instantly.</span>
        </h2>

        <div className="rounded-2xl p-5 backdrop-blur-sm" style={{ background: "#FFFFFF0D", border: "1px solid #FFFFFF1F" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#5FD07A" }} />
              <span className="text-xs uppercase tracking-wider text-white" style={{ fontFamily: FM }}>Match found</span>
            </div>
            <span className="text-xs" style={{ color: C.blush, fontFamily: FM }}>Nearby You</span>
          </div>
          <VitalsLine />
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck size={13} color={C.blush} />
            <p className="text-xs" style={{ color: "#FFFFFFB3", fontFamily: FB }}>Contact only unlocks once a donor accepts.</p>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-xs" style={{ color: "#FFFFFF66", fontFamily: FB }}>
        A student prototype, not yet a registered product.
      </p>
    </div>
  );
}

/* ---------------- Login form ---------------- */

function LoginForm({ onSwitch }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const emailCheck = useMemo(() => validateEmail(email), [email]);
  const canSubmit = emailCheck.valid && password.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    loginUser(email);
    navigate("/action");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm"
      style={{ animation: shake ? "shake 0.4s ease" : undefined }}
    >
      <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: C.ink, fontFamily: FD }}>Welcome back</h1>
      <p className="text-sm mb-8" style={{ color: C.sub, fontFamily: FB }}>
        Log in to check nearby requests and your donation history.
      </p>

      <div className="flex flex-col gap-3.5">
        <Field
          icon={Mail}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
          error={touched && email && !emailCheck.valid ? emailCheck.reason : ""}
        />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <div className="flex justify-end mt-3">
        <button type="button" className="text-xs transition-colors hover:opacity-70" style={{ color: C.sub, fontFamily: FB }}>
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="w-full mt-6 py-3.5 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.015] active:scale-95"
        style={{ background: C.brick, fontFamily: FB }}
      >
        Log in <ArrowRight size={15} />
      </button>

      <OrDivider />
      <GoogleButton label="Sign in with Google" />

      <p className="text-sm text-center mt-8" style={{ color: C.sub, fontFamily: FB }}>
        New to RaktJaal?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold hover:underline" style={{ color: C.ink }}>
          Create an account
        </button>
      </p>
    </form>
  );
}

/* ---------------- Address Editor Dependencies ---------------- */

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

const STATE_CITIES = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Agra", "Varanasi"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Saket"],
};
const OTHER_CITY = "__other__";

function validatePincode(v) {
  const trimmed = (v || "").trim();
  if (!trimmed) return { valid: false, reason: "PIN code can't be empty.", normalized: trimmed };
  if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
    return { valid: false, reason: "Enter a valid 6-digit Indian PIN code.", normalized: trimmed };
  }
  return { valid: true, reason: "", normalized: trimmed };
}

async function lookupPincode(pincode) {
  try {
    // ATTEMPT 1: Official Indian Post API (Highest precision, but unstable)
    // We wrap this in a strict 3-second timeout so it never hangs forever.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
      const postRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (postRes.ok) {
        const postData = await postRes.json();
        const result = Array.isArray(postData) ? postData[0] : null;
        if (result && result.Status === "Success" && Array.isArray(result.PostOffice) && result.PostOffice.length > 0) {
          const state = result.PostOffice[0].State;
          const localities = [...new Set(result.PostOffice.map((po) => po.Name).filter(Boolean))];
          return { state, localities };
        }
      }
    } catch (err) {
      // If the postal API times out (takes > 3s) or crashes, we catch it here 
      // and instantly fall through to Attempt 2.
      clearTimeout(timeoutId);
    }

    // ATTEMPT 2: OpenStreetMap (Nominatim) API (Lightning fast, reliable, high precision fallback)
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=india&format=json&addressdetails=1`);
    if (!nomRes.ok) return null;
    
    const nomData = await nomRes.json();
    if (!nomData || nomData.length === 0) return null;

    let state = "";
    const localities = new Set();

    nomData.forEach((place) => {
      const addr = place.address;
      if (!addr) return;
      
      if (addr.state && !state) {
        state = addr.state;
        if (state.includes("Delhi")) state = "Delhi";
      }
      
      // OpenStreetMap provides highly specific local data. We cascade down to find the most precise area.
      const locality = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || addr.state_district;
      if (locality) localities.add(locality);
    });

    // Ensure the returned state perfectly matches our dropdown array
    const matchedState = INDIAN_STATES.find(s => 
      state.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(state.toLowerCase())
    ) || state;

    const localityArray = [...localities];
    if (!matchedState || localityArray.length === 0) return null;

    return { state: matchedState, localities: localityArray };
    
  } catch {
    return null; // Both APIs failed, safely fall back to manual entry
  }
}

function validateRequiredText(v, label, minLen = 2) {
  const trimmed = (v || "").trim(); 
  if (!trimmed) return { valid: false, reason: `${label} can't be empty.`, normalized: trimmed };
  if (trimmed.length < minLen) return { valid: false, reason: `${label} is too short.`, normalized: trimmed };
  return { valid: true, reason: "", normalized: trimmed };
}

function addressIsComplete(addr) {
  return Boolean(addr && addr.street?.trim() && addr.city?.trim() && addr.state?.trim() && addr.pincode?.trim());
}

function formatAddress(addr) {
  if (!addr) return "";
  const parts = [addr.street, addr.city, addr.state, addr.pincode, addr.country].map((p) => (p || "").trim()).filter(Boolean);
  return parts.join(", ");
}

function AddressEditor({ value, onSave, onCancel }) {
  const defaultAddress = { pincode: "", state: "", city: "", street: "", country: "India" };
  const [draft, setDraft] = useState(typeof value === "object" && value !== null ? value : defaultAddress);
  
  const [touched, setTouched] = useState(false);
  const [lookupState, setLookupState] = useState("idle");
  const [localities, setLocalities] = useState([]);
  const [cityMode, setCityMode] = useState(draft.city ? OTHER_CITY : "");

  useEffect(() => {
    const pin = (draft.pincode || "").trim();
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
          city: d.city ? d.city : result.localities[0] || d.city,
        }));
      } else {
        setLookupState("failed");
        setLocalities([]);
      }
    });
    return () => { cancelled = true; };
  }, [draft.pincode]);

  const cityOptions = localities.length > 0 ? localities : (STATE_CITIES[draft.state] || []);
  const checks = {
    pincode: validatePincode(draft.pincode),
    state: (draft.state || "").trim() ? { valid: true } : { valid: false, reason: "Select a state." },
    city: validateRequiredText(draft.city, "City", 2),
    street: validateRequiredText(draft.street, "Street address", 4),
  };
  const allValid = Object.values(checks).every((c) => c.valid);

  return (
    <div className="flex flex-col gap-3.5 text-left">
      <div>
        <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}>PIN code</label>
        <div className="flex items-center gap-2">
          <input
            value={draft.pincode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setDraft((d) => ({ ...d, pincode: v }));
              setTouched(true);
            }}
            inputMode="numeric"
            placeholder="6-digit PIN"
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: C.ink, fontFamily: FB, fontWeight: 500, borderColor: touched && !checks.pincode.valid ? C.brick : C.ink }}
          />
          {lookupState === "loading" && <Loader2 size={14} color={C.sub} className="animate-spin shrink-0" />}
        </div>
        {touched && !checks.pincode.valid && <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: FB }}>{checks.pincode.reason}</p>}
        {lookupState === "done" && <p className="text-[11px] mt-1" style={{ color: "#1F6B3A", fontFamily: FB }}>State and city auto-filled.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}>State</label>
          <select
            value={draft.state}
            onChange={(e) => {
              setDraft((d) => ({ ...d, state: e.target.value, city: "" }));
              setCityMode("");
              setTouched(true);
            }}
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: draft.state ? C.ink : "#A1A1AA", fontFamily: FB, fontWeight: 500, borderColor: touched && !checks.state.valid ? C.brick : C.ink }}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {touched && !checks.state.valid && <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: FB }}>{checks.state.reason}</p>}
        </div>

        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}>City</label>
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
              style={{ color: draft.city ? C.ink : "#A1A1AA", fontFamily: FB, fontWeight: 500, borderColor: touched && !checks.city.valid ? C.brick : C.ink }}
            >
              <option value="">{draft.state || cityOptions.length ? "Select city" : "Wait for PIN"}</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OTHER_CITY}>Other (type manually)</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft.city}
                onChange={(e) => { setDraft((d) => ({ ...d, city: e.target.value })); setTouched(true); }}
                placeholder="City name"
                className="w-full text-sm bg-transparent outline-none border-b pb-1"
                style={{ color: C.ink, fontFamily: FB, fontWeight: 500, borderColor: touched && !checks.city.valid ? C.brick : C.ink }}
              />
              {cityOptions.length > 0 && (
                <button type="button" onClick={() => { setCityMode(""); setDraft((d) => ({ ...d, city: "" })); }} className="shrink-0 text-[10px] text-gray-500 hover:opacity-70">
                  Use list
                </button>
              )}
            </div>
          )}
          {touched && !checks.city.valid && <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: FB }}>{checks.city.reason}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}>Street address</label>
          <input
            value={draft.street}
            onChange={(e) => { setDraft((d) => ({ ...d, street: e.target.value })); setTouched(true); }}
            placeholder="House no., area"
            className="w-full text-sm bg-transparent outline-none border-b pb-1"
            style={{ color: C.ink, fontFamily: FB, fontWeight: 500, borderColor: touched && !checks.street.valid ? C.brick : C.ink }}
          />
          {touched && !checks.street.valid && <p className="text-[11px] mt-1" style={{ color: C.brickDark, fontFamily: FB }}>{checks.street.reason}</p>}
        </div>
        <div>
          <label className="block text-[11.5px] mb-1" style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}>Country</label>
          <input value={draft.country} disabled className="w-full text-sm bg-transparent outline-none border-b pb-1" style={{ color: "#A1A1AA", fontFamily: FB, fontWeight: 500, borderColor: `${C.ink}22`, cursor: "not-allowed" }} />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="button" onClick={onCancel} className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-gray-100" style={{ border: `1px solid ${C.ink}22`, color: C.ink, fontFamily: FB, fontWeight: 600 }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setTouched(true);
            if (!allValid) return;
            onSave(draft);
          }}
          disabled={touched && !allValid}
          className="text-xs px-3.5 py-2 rounded-full text-white transition-opacity"
          style={{ background: C.ink, fontFamily: FB, fontWeight: 600, opacity: touched && !allValid ? 0.4 : 1 }}
        >
          Save address
        </button>
      </div>
    </div>
  );
}

/* ---------------- Register form ---------------- */

function RegisterForm({ onSwitch }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    name: "", 
    dob: "", 
    email: "", 
    address: { pincode: "", state: "", city: "", street: "", country: "India" }, 
    bloodType: "O+", 
    password: "" 
  });
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailCheck = useMemo(() => validateEmail(form.email), [form.email]);
  const checks = passwordChecks(form.password);
  const passwordValid = checks.length && checks.upper && checks.number && checks.symbol;
  
  const canSubmit = form.name.trim() && form.dob && emailCheck.valid && addressIsComplete(form.address) && passwordValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    registerUser({
      name: form.name,
      dob: form.dob,
      email: form.email,
      address: form.address,
      bloodType: form.bloodType,
    });
    navigate("/action");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm"
      style={{ animation: shake ? "shake 0.4s ease" : undefined }}
    >
      <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: C.ink, fontFamily: FD }}>Create your account</h1>
      <p className="text-sm mb-8" style={{ color: C.sub, fontFamily: FB }}>
        A quick profile so matches stay accurate and eligible.
      </p>

      <div className="flex flex-col gap-3.5">
        <Field icon={User} required value={form.name} onChange={update("name")} placeholder="Full name" />
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarDays size={18} color="#A1A1AA" />
          </div>
          <input
            type="date"
            name="dob"
            value={form.dob || ""}
            onChange={update("dob")}
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors"
            style={{
              backgroundColor: "#FFFFFF",
              border: `1.5px solid ${C.ink}22`,
              color: form.dob ? C.ink : "#A1A1AA", 
              fontFamily: FB
            }}
          />
        </div>
        <Field
          icon={Mail}
          type="email"
          required
          value={form.email}
          onChange={update("email")}
          placeholder="you@gmail.com"
          error={touched && form.email && !emailCheck.valid ? emailCheck.reason : ""}
        />

        {addressExpanded ? (
          <div className="rounded-2xl p-4 bg-white transition-all duration-200" style={{ border: `1.5px solid ${C.ink}22` }}>
            <AddressEditor
              value={form.address}
              onSave={(addr) => {
                setForm((f) => ({ ...f, address: addr }));
                setAddressExpanded(false);
              }}
              onCancel={() => setAddressExpanded(false)}
            />
          </div>
        ) : (
          <div onClick={() => setAddressExpanded(true)} style={{ cursor: "pointer" }}>
            <div className="pointer-events-none">
              <Field 
                icon={MapPin} 
                required 
                readOnly 
                value={addressIsComplete(form.address) ? formatAddress(form.address) : ""} 
                placeholder="Address" 
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white transition-all duration-200" style={{ border: `1.5px solid ${C.ink}22` }}>
          <Droplet size={17} style={{ color: C.sub }} className="shrink-0" />
          <select
            value={form.bloodType}
            onChange={update("bloodType")}
            className="w-full bg-transparent text-sm outline-none"
            style={{ fontFamily: FB, color: C.ink }}
          >
            {["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <PasswordField value={form.password} onChange={update("password")} placeholder="Create a password" showRules />
      </div>

      <button
        type="submit"
        className="w-full mt-6 py-3.5 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.015] active:scale-95"
        style={{ background: C.brick, fontFamily: FB }}
      >
        Create account <ArrowRight size={15} />
      </button>

      <OrDivider />
      <GoogleButton label="Sign in with Google" />

      <p className="text-sm text-center mt-8" style={{ color: C.sub, fontFamily: FB }}>
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold hover:underline" style={{ color: C.ink }}>
          Log in
        </button>
      </p>
    </form>
  );
}

/* ---------------- Root ---------------- */

export default function AuthPage({ initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);

  return (
    <div className="min-h-screen flex" style={{ background: C.paper }}>
      <style>{FONT_IMPORT}</style>

      <BrandPanel />

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12 relative">
        <Link to="/" className="lg:hidden flex items-center gap-2 mb-10">
          <BrandMark size={26} />
          <span className="text-lg font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
        </Link>

        <div
          key={mode}
          className="w-full max-w-sm rounded-[2rem] p-8 md:p-9"
          style={{
            background: "#fff",
            border: `1px solid ${C.ink}12`,
            boxShadow: "0 30px 60px -30px rgba(20,17,15,0.25)",
            animation: "cardIn 0.4s cubic-bezier(.22,.61,.36,1)",
          }}
        >
          <div className="w-full flex rounded-full p-1 mb-8" style={{ background: "#F4F2EF" }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  fontFamily: FB,
                  background: mode === m ? C.ink : "transparent",
                  color: mode === m ? "#fff" : C.sub,
                }}
              >
                {m === "login" ? "Log in" : "Register"}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <LoginForm onSwitch={() => setMode("register")} />
          ) : (
            <RegisterForm onSwitch={() => setMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}