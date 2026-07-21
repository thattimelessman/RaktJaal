import { useState, useMemo } from "react";
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
} from "lucide-react";
import { registerUser, loginUser } from "./AuthStore";

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

/* ---------------- Branding panel ---------------- */

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
            <span className="text-xs" style={{ color: C.blush, fontFamily: FM }}>1.2km away</span>
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
    // Looks up this exact email in the local directory — logs into
    // their own saved profile if known, or starts a fresh empty one
    // if not. Never reuses another email's leftover data.
    loginUser(email);
    navigate("/profile");
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

      <p className="text-sm text-center mt-8" style={{ color: C.sub, fontFamily: FB }}>
        New to RaktJaal?{" "}
        <button type="button" onClick={onSwitch} className="font-semibold hover:underline" style={{ color: C.ink }}>
          Create an account
        </button>
      </p>
    </form>
  );
}

/* ---------------- Register form ---------------- */

function RegisterForm({ onSwitch }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", city: "", bloodType: "O+", password: "" });
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailCheck = useMemo(() => validateEmail(form.email), [form.email]);
  const checks = passwordChecks(form.password);
  const passwordValid = checks.length && checks.upper && checks.number && checks.symbol;
  const canSubmit = form.name.trim() && emailCheck.valid && form.city.trim() && passwordValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    // Saved fields only — never the password. There's no backend yet
    // to hash it, so it isn't persisted anywhere, even locally.
    registerUser({
      name: form.name,
      email: form.email,
      city: form.city,
      bloodType: form.bloodType,
    });
    navigate("/profile");
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
        <Field
          icon={Mail}
          type="email"
          required
          value={form.email}
          onChange={update("email")}
          placeholder="you@gmail.com"
          error={touched && form.email && !emailCheck.valid ? emailCheck.reason : ""}
        />
        <Field icon={MapPin} required value={form.city} onChange={update("city")} placeholder="City" />

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