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
  cream: "#EDEAE3",
  stage: "#F7F5F0",
  field: "#F2F0EA",
};

const FD = "'Plus Jakarta Sans', sans-serif";
const FB = "'Manrope', sans-serif";
const FM = "'JetBrains Mono', monospace";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.6; } 70% { transform: scale(1.6); opacity: 0; } 100% { opacity: 0; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dash { to { stroke-dashoffset: 0; } }
@keyframes cardIn { from { opacity: 0; transform: translateY(18px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shake { 10%,90% { transform: translateX(-1px); } 20%,80% { transform: translateX(2px); } 30%,50%,70% { transform: translateX(-4px); } 40%,60% { transform: translateX(4px); } }
@keyframes trace { 0%, 100% { stroke-dashoffset: 800; } 50% { stroke-dashoffset: 0; } }
@keyframes dashLoop { to { stroke-dashoffset: -100; } }
@keyframes triFlicker {
  0%, 100% {
    transform: translate(0px, 0px);
    text-shadow: -2px -2px 0px #FFD400, 2px 2px 0px #1E3FFF;
  }
  25% {
    transform: translate(1px, -1px);
    text-shadow: -3px 0px 0px #FFD400, 3px 2px 0px #1E3FFF;
  }
  50% {
    transform: translate(-1px, 1px);
    text-shadow: -1px -3px 0px #FFD400, 1px 3px 0px #1E3FFF;
  }
  75% {
    transform: translate(1px, 1px);
    text-shadow: -2px 1px 0px #FFD400, 2px -1px 0px #1E3FFF;
  }
}
.hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
.hide-scroll::-webkit-scrollbar { display: none; }
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
        className="flex items-center gap-3 rounded-full px-5 py-3.5 transition-all duration-200"
        style={{ background: error ? `${C.brick}0D` : C.field, border: `1.5px solid ${error ? C.brick : "transparent"}` }}
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
        className="flex items-center gap-3 rounded-full px-5 py-3.5 transition-all duration-200"
        style={{ background: value && !allGood && !focused ? `${C.brick}0D` : C.field, border: `1.5px solid ${value && !allGood && !focused ? C.brick : "transparent"}` }}
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
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-full text-[15px] font-bold bg-white transition-all duration-200 hover:bg-[#F9F9F8] active:scale-[0.98] disabled:opacity-60"
        style={{ border: `1.5px solid ${C.ink}1A`, fontFamily: FB, color: C.ink }}
      >
        {pending ? (
          <span className="w-[18px] h-[18px] rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.ink}33`, borderTopColor: "transparent" }} />
        ) : (
          <GoogleGlyph />
        )}
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

/* ---------------- New Sketchy Illustrations & Taglines ---------------- */

function SaveLifeIllustration() {
  return (
    <svg width="260" height="260" viewBox="0 0 260 260" fill="none" style={{ overflow: "visible" }}>
      {/* Restored Yellow Leaf Base */}
      <path 
        d="M 50 210 C 100 170, 200 180, 230 210 C 180 250, 80 240, 50 210 Z" 
        fill="#FCE3A1" 
        style={{ animation: "fadeUp 1.5s ease" }} 
      />
      
      {/* Sketchy Black Leaf Outline tracking the yellow shape */}
      <g style={{ strokeDasharray: 800, animation: "trace 8s ease-in-out infinite" }}>
        <path 
          d="M 45 215 C 105 165, 210 175, 240 210 C 185 255, 75 245, 45 215 Z" 
          stroke={C.ink} 
          strokeWidth="1.2" 
          fill="none" 
          strokeLinecap="round" 
        />
        {/* Leaf Stem */}
        <path d="M 15 245 C 25 235, 35 225, 45 215" stroke={C.ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
      
      {/* Crisp Cloud Outline */}
      <path 
        d="M 90 170 C 50 170, 30 140, 45 100 C 30 60, 80 30, 110 50 C 130 20, 180 30, 180 70 C 220 80, 200 140, 170 150 C 150 170, 120 175, 90 170" 
        stroke={C.ink} 
        strokeWidth="1.2" 
        fill="none" 
        strokeLinecap="round"
        style={{ strokeDasharray: 600, animation: "trace 8s ease-in-out infinite" }} 
      />

      {/* Red Heart/Leaf shape */}
      <path 
        d="M 170 155 C 150 125, 175 105, 185 125 C 205 90, 240 120, 225 160 C 210 200, 180 180, 170 155 Z" 
        fill={C.brick} 
        opacity="0" 
        style={{ animation: "fadeUp 1s ease forwards 1s" }} 
      />

      {/* Text annotations */}
      <text x="80" y="105" fontFamily={FM} fontSize="13" fill={C.ink} opacity="0" style={{ animation: "fadeUp 1s ease forwards 0.5s" }}>
        save a life
      </text>
      <text x="88" y="125" fontFamily={FM} fontSize="13" fill={C.sub} opacity="0" style={{ animation: "fadeUp 1s ease forwards 0.8s" }}>
        today.
      </text>
    </svg>
  );
}

function RightPaneIllustration() {
  return (
    <svg width="280" height="350" viewBox="0 0 400 500" fill="none" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id="bagInner">
          <rect x="131.5" y="381.5" width="137" height="177" rx="13.5" />
        </clipPath>
      </defs>

      {/* Blood Bag */}
      <g style={{ animation: "fadeUp 1.5s ease forwards 0.6s", opacity: 0 }}>
        {/* Bag Outline */}
        <rect x="130" y="380" width="140" height="180" rx="15" fill={C.paper} fillOpacity="0.95" stroke={C.ink} strokeWidth="3" />
        
        {/* Animated Waving Blood */}
        <g clipPath="url(#bagInner)">
          {/* Deep Blood Base */}
          <rect x="130" y="425" width="140" height="150" fill={C.brickDark} />
          
          {/* Waving Blood Surface */}
          <path 
            d="M 130 425 q 35 -12 70 0 t 70 0 t 70 0 t 70 0 t 70 0 t 70 0 l 0 50 l -420 0 z" 
            fill={C.brick}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-140 0"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </path>
        </g>
        
        {/* Medical Label */}
        <rect x="150" y="440" width="100" height="70" rx="4" fill={C.paper} stroke={`${C.ink}22`} strokeWidth="1" />
        <rect x="160" y="450" width="30" height="30" fill={C.stage} />
        <path d="M 175,455 L 175,475 M 165,465 L 185,465" stroke={C.brick} strokeWidth="4" strokeLinecap="round" /> {/* Red Cross */}
        <line x1="200" y1="455" x2="240" y2="455" stroke={C.sub} strokeWidth="2" strokeLinecap="round" />
        <line x1="200" y1="465" x2="230" y2="465" stroke={C.sub} strokeWidth="2" strokeLinecap="round" />
        <line x1="160" y1="490" x2="240" y2="490" stroke={C.sub} strokeWidth="2" strokeLinecap="round" />
        <line x1="160" y1="500" x2="220" y2="500" stroke={C.sub} strokeWidth="2" strokeLinecap="round" />

        {/* Top Hanger */}
        <path d="M 190,380 L 190,360 Q 200,350 210,360 L 210,380" fill="none" stroke={C.sub} strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function LeftTagline() {
  return (
    <div className="w-[260px] text-right" style={{ animation: "fadeUp 1.5s ease forwards 0.3s", opacity: 0 }}>
      <div className="flex items-center justify-end gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#1F6B3A" }} />
        <p className="text-[10px] tracking-[0.2em] font-bold uppercase" style={{ color: "#1F6B3A", fontFamily: FB }}>
          Why This Matters
        </p>
      </div>
      <h2 className="text-[1.65rem] leading-[1.25] font-extrabold tracking-tight text-right" style={{ color: C.ink, fontFamily: FB }}>
        Every drop finds <br />
        <span style={{ color: C.sub }}>somewhere to go</span> <br />
        <span style={{ color: C.brick }}>instantly.</span>
      </h2>
    </div>
  );
}

function SuperheroTagline() {
  return (
    <div className="w-[220px] text-left" style={{ animation: "fadeUp 1.5s ease forwards 0.3s", opacity: 0 }}>
      <div style={{ color: C.sub, fontSize: "15px", fontFamily: FD, fontWeight: 600, letterSpacing: "0.5px", marginBottom: "6px" }}>
        You Can Be Someone's
      </div>
            <div
        style={{
          color: "#E5202E",
          fontSize: "42px",
          fontFamily: FD,
          fontWeight: 800,
          letterSpacing: "0.5px",
          lineHeight: 1,
          display: "inline-block",
          animation: "triFlicker 1.8s ease-in-out infinite"
        }}
      >
        SUPERHERO!
      </div>
    </div>
  );
}

function RightTagline() {
  return (
    
    <div className="w-[260px] text-right flex flex-col items-end" style={{ animation: "fadeUp 1.5s ease forwards 0.5s", opacity: 0 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[#1F6B3A] animate-pulse" />
        
        <p className="text-[10px] tracking-[0.2em] font-bold uppercase" style={{ color: "#1F6B3A", fontFamily: FM }}>
          Privacy First
        </p>
      </div>
      <h2 className="text-[1.65rem] leading-[1.25] font-extrabold tracking-tight text-right" style={{ color: C.ink, fontFamily: FB }}>
        Contact info <br />
        <span style={{ color: C.sub }}>only unlocks when</span> <br />
        a donor <span style={{ color: C.brick }}>accepts.</span>
      </h2>
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
      className="w-full max-w-sm mx-auto"
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
        className="w-full mt-6 py-3.5 rounded-full text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.015] active:scale-95"
        style={{ background: C.brick, fontFamily: FB }}
      >
        Log in <ArrowRight size={15} />
      </button>

      <OrDivider />
      <GoogleButton label="Sign in with Google" />

      <p className="text-sm text-center mt-8 pb-4" style={{ color: C.sub, fontFamily: FB }}>
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
      clearTimeout(timeoutId);
    }

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
      
      const locality = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || addr.state_district;
      if (locality) localities.add(locality);
    });

    const matchedState = INDIAN_STATES.find(s => 
      state.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(state.toLowerCase())
    ) || state;

    const localityArray = [...localities];
    if (!matchedState || localityArray.length === 0) return null;

    return { state: matchedState, localities: localityArray };
    
  } catch {
    return null; 
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
      className="w-full max-w-sm mx-auto"
      style={{ animation: shake ? "shake 0.4s ease" : undefined }}
    >
      <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: C.ink, fontFamily: FD }}>Create your account</h1>
      <p className="text-sm mb-8" style={{ color: C.sub, fontFamily: FB }}>
        A quick profile so matches stay accurate and eligible.
      </p>

      <div className="flex flex-col gap-3.5">
        <Field icon={User} required value={form.name} onChange={update("name")} placeholder="Full name" />
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <CalendarDays size={17} color={C.sub} />
          </div>
          <input
            type="date"
            name="dob"
            value={form.dob || ""}
            onChange={update("dob")}
            className="w-full pl-11 pr-5 py-3.5 rounded-full text-sm outline-none transition-colors"
            style={{
              backgroundColor: C.field,
              border: "1.5px solid transparent",
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

        <div className="flex items-center gap-3 rounded-full px-5 py-3.5 transition-all duration-200" style={{ background: C.field, border: "1.5px solid transparent" }}>
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
        className="w-full mt-6 py-3.5 rounded-full text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.015] active:scale-95"
        style={{ background: C.brick, fontFamily: FB }}
      >
        Create account <ArrowRight size={15} />
      </button>

      <OrDivider />
      <GoogleButton label="Sign in with Google" />

      <p className="text-sm text-center mt-8 pb-4" style={{ color: C.sub, fontFamily: FB }}>
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
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8" style={{ background: C.cream }}>
      <style>{FONT_IMPORT}</style>

      <div
        className="relative w-full max-w-6xl rounded-[2.5rem] overflow-hidden flex items-center justify-center py-12 px-6 md:px-16"
        style={{ background: C.stage, minHeight: 700 }}
      >
        <div className="absolute top-8 left-8 z-30 flex flex-col items-start">
          <Link to="/" className="inline-flex items-center gap-2 relative z-10">
            <BrandMark size={30} />
            <span className="text-xl font-bold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>RaktJaal</span>
          </Link>
          
          {/* Clickable Sketch Arrow with Tooltip (Untouched) */}
          <Link to="/" className="relative group mt-0.5 ml-2 cursor-pointer">
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
              className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[11px] px-2.5 py-1.5 rounded shadow-sm border pointer-events-none whitespace-nowrap" 
              style={{ color: C.ink, fontFamily: FB, borderColor: `${C.ink}22` }}
            >
              go back to home page
            </div>
          </Link>
        </div>

        {/* --- LEFT COLUMN: Superhero tagline, sits above the save-a-life illustration --- */}
        <div className="hidden lg:block absolute left-10 top-[38%] -translate-y-1/2 z-0 pointer-events-none">
          <SuperheroTagline />
        </div>

        {/* --- RIGHT COLUMN: Why This Matters + Privacy First, stacked together --- */}
        <div className="hidden lg:flex flex-col items-end gap-10 absolute right-10 top-1/2 -translate-y-1/2 z-0 pointer-events-none">
          <LeftTagline />
          <RightTagline />
        </div>

        <div className="hidden lg:block absolute left-6 bottom-6 opacity-90 pointer-events-none">
          <SaveLifeIllustration />
        </div>

        <div className="hidden lg:block absolute right-8 bottom-6 opacity-90 pointer-events-none">
          <RightPaneIllustration />
        </div>

        <div
          key={mode}
          className="relative z-10 w-full max-w-sm rounded-[2rem] bg-white flex flex-col hide-scroll"
          style={{
            height: "660px",
            boxShadow: "0 30px 60px -25px rgba(20,17,15,0.22)",
            animation: "cardIn 0.4s cubic-bezier(.22,.61,.36,1)",
          }}
        >
          <div className="p-8 md:p-9 pb-4 shrink-0">
            <div className="w-full flex rounded-full p-1" style={{ background: C.field }}>
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
          </div>

          <div className="px-8 md:px-9 pb-8 md:pb-9 pt-0 flex-1 overflow-y-auto hide-scroll">
            {mode === "login" ? (
              <LoginForm onSwitch={() => setMode("register")} />
            ) : (
              <RegisterForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>

        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-center z-10" style={{ color: C.sub, fontFamily: FB }}>
          A student prototype, not yet a registered product.
        </p>
      </div>
    </div>
  );
}