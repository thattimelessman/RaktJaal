import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, saveCurrentUser, clearCurrentUser } from "./AuthStore";
import {
  Droplet,
  MapPin,
  Phone,
  Mail,
  Edit3,
  Check,
  X,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Plus,
} from "lucide-react";

/* ---------------------------------------------------------------
   Shared design tokens — keep these in sync with the rest of the
   site (Hero / Nav / Footer). Duplicated here only because this
   file is meant to drop in standalone; move to a shared tokens.js
   once the project has one.
------------------------------------------------------------------ */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
`;

const C = {
  ink: "#14110F",
  paper: "#FFFFFF",
  sub: "#78716A",
  brick: "#D6303F",
  brickDark: "#B21F2D",
  blush: "#FDE2E4",
  peach: "#FFE8D2",
  mint: "#DEF5E4",
  sky: "#DCEEFF",
  border: "#14110F1A",
};
const FD = "'Plus Jakarta Sans', sans-serif";
const FB = "'Manrope', sans-serif";
const FM = "'JetBrains Mono', monospace";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/* Same mark used in Nav (RaktJaal.jsx) and BrandPanel (AuthPage.jsx) —
   duplicated here for the same standalone-file reason as the tokens above. */
function BrandMark({ size = 22 }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40" className="relative">
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

const REQUIRED_FIELDS = [
  { key: "name", label: "Full name", icon: null },
  { key: "phone", label: "Phone number", icon: Phone },
  { key: "city", label: "City", icon: MapPin },
  { key: "bloodType", label: "Blood type", icon: Droplet },
];

function missingFields(user) {
  if (!user) return REQUIRED_FIELDS;
  return REQUIRED_FIELDS.filter((f) => !user[f.key] || String(user[f.key]).trim() === "");
}

/* ---------------------------------------------------------------
   Signed-out state — no user in storage at all
------------------------------------------------------------------ */
function SignedOut() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.paper }}>
      <style>{FONT_IMPORT}</style>
      <div className="text-center max-w-sm">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: C.blush }}
        >
          <Droplet size={22} color={C.brick} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: C.ink, fontFamily: FD }}>
          You're not signed in
        </h1>
        <p className="text-sm mb-7" style={{ color: C.sub, fontFamily: FB }}>
          Create an account or log in to see your donor profile.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-full text-sm text-white transition-transform hover:scale-[1.04] active:scale-95"
            style={{ background: C.brick, fontFamily: FB, fontWeight: 600 }}
          >
            Create account
          </Link>
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-full text-sm transition-colors hover:bg-[#F4F2EF]"
            style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: FB, fontWeight: 600 }}
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   One editable/read-only field row
------------------------------------------------------------------ */
function FieldRow({ label, icon: Icon, value, editing, name, type = "text", onChange, options }) {
  return (
    <div className="flex items-center gap-4 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "#F4F2EF" }}
      >
        {Icon ? <Icon size={15} color={C.sub} /> : <span className="text-xs" style={{ color: C.sub }}>—</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs mb-1" style={{ color: C.sub, fontFamily: FM }}>
          {label}
        </div>
        {!editing ? (
          value ? (
            <div className="text-sm truncate" style={{ color: C.ink, fontFamily: FB, fontWeight: 500 }}>
              {value}
            </div>
          ) : (
            <div className="text-sm italic" style={{ color: C.sub, fontFamily: FB }}>
              Not added yet
            </div>
          )
        ) : options ? (
          <select
            name={name}
            value={value || ""}
            onChange={onChange}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: C.ink, fontFamily: FB, fontWeight: 500 }}
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            value={value || ""}
            onChange={onChange}
            placeholder={`Add ${label.toLowerCase()}`}
            className="w-full text-sm bg-transparent outline-none"
            style={{ color: C.ink, fontFamily: FB, fontWeight: 500 }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Donation history — honest empty state for a brand-new donor
------------------------------------------------------------------ */
function DonationHistory({ donations }) {
  if (!donations || donations.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "#F9F7F4", border: `1px dashed ${C.border}` }}
      >
        <p className="text-sm" style={{ color: C.sub, fontFamily: FB }}>
          No donations yet. Once you donate through RaktJaal, it'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {donations.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: "#F9F7F4" }}
        >
          <div>
            <div className="text-sm" style={{ color: C.ink, fontFamily: FB, fontWeight: 600 }}>
              {d.location || "Location not recorded"}
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: FB }}>
              {d.date}
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-xs text-white"
            style={{ background: C.brick, fontFamily: FM }}
          >
            {d.units ? `${d.units} unit${d.units > 1 ? "s" : ""}` : "1 unit"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Next-eligible-donation line — honest logic, no fabricated dates
------------------------------------------------------------------ */
function nextEligibleText(donations) {
  if (!donations || donations.length === 0) {
    return "You're eligible to donate right now.";
  }
  const last = donations[donations.length - 1];
  if (!last?.date) return "You're eligible to donate right now.";

  const lastDate = new Date(last.date);
  if (isNaN(lastDate.getTime())) return "You're eligible to donate right now.";

  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + 90); // standard ~3-month gap between whole-blood donations
  const now = new Date();

  if (nextDate <= now) return "You're eligible to donate right now.";
  return `Eligible again from ${nextDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`;
}

/* ---------------------------------------------------------------
   Main page
------------------------------------------------------------------ */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentUser()); // lazy init: read session once, on mount
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);

  if (!user) return <SignedOut />;

  const missing = missingFields(user);

  const startEditing = () => {
    setDraft({ ...user });
    setEditing(true);
    setSaved(false);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDraft((d) => ({ ...d, [name]: value }));
  };

  const handleSave = () => {
    const updated = { ...user, ...draft };
    saveCurrentUser(updated);
    setUser(updated);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login");
  };

  const displayName = user.name?.trim() || "Unnamed donor";
  const initials =
    user.name?.trim()
      ? user.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
      : "?";

  return (
    <div className="min-h-screen" style={{ background: C.paper }}>
      <style>{FONT_IMPORT}</style>
      {/* top bar */}
      <header style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark size={22} />
            <span className="text-sm font-semibold" style={{ color: C.ink, fontFamily: FD }}>
              RaktJaal
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full transition-colors hover:bg-[#F4F2EF]"
            style={{ color: C.sub, fontFamily: FB, fontWeight: 600 }}
          >
            <LogOut size={13} /> Log out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* incomplete-profile banner */}
        {missing.length > 0 && !editing && (
          <div
            className="flex items-start gap-3 rounded-2xl p-4 mb-6"
            style={{ background: C.peach }}
          >
            <AlertCircle size={17} color={C.brickDark} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm" style={{ color: C.ink, fontFamily: FB, fontWeight: 600 }}>
                Your profile is missing {missing.length} detail{missing.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs mt-0.5" style={{ color: C.sub, fontFamily: FB }}>
                {missing.map((f) => f.label).join(", ")} — donors with complete profiles get matched faster.
              </p>
            </div>
            <button
              onClick={startEditing}
              className="shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-full text-white"
              style={{ background: C.ink, fontFamily: FB, fontWeight: 600 }}
            >
              <Plus size={13} /> Complete
            </button>
          </div>
        )}

        {/* profile card */}
        <div className="rounded-3xl p-7" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-start justify-between mb-7">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold"
                style={{ background: C.blush, color: C.brickDark, fontFamily: FD }}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>
                    {displayName}
                  </h1>
                  {user.verified && (
                    <span title="Verified donor">
                      <ShieldCheck size={16} color={C.brick} />
                    </span>
                  )}
                </div>
                {user.bloodType && (
                  <span
                    className="inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs text-white"
                    style={{ background: C.brick, fontFamily: FM }}
                  >
                    {user.bloodType}
                  </span>
                )}
              </div>
            </div>

            {!editing ? (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-[#F4F2EF]"
                style={{ border: `1px solid ${C.border}`, color: C.ink, fontFamily: FB, fontWeight: 600 }}
              >
                <Edit3 size={13} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEditing}
                  aria-label="Cancel"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F2EF]"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  <X size={14} color={C.sub} />
                </button>
                <button
                  onClick={handleSave}
                  aria-label="Save"
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: C.ink }}
                >
                  <Check size={14} color="#fff" />
                </button>
              </div>
            )}
          </div>

          {saved && (
            <p className="text-xs mb-4" style={{ color: C.brickDark, fontFamily: FB, fontWeight: 600 }}>
              Saved.
            </p>
          )}

          {/* fields */}
          <FieldRow
            label="Full name"
            icon={null}
            value={editing ? draft.name : user.name}
            editing={editing}
            name="name"
            onChange={handleChange}
          />
          <FieldRow
            label="Email"
            icon={Mail}
            value={editing ? draft.email : user.email}
            editing={editing}
            name="email"
            type="email"
            onChange={handleChange}
          />
          <FieldRow
            label="Phone number"
            icon={Phone}
            value={editing ? draft.phone : user.phone}
            editing={editing}
            name="phone"
            type="tel"
            onChange={handleChange}
          />
          <FieldRow
            label="City"
            icon={MapPin}
            value={editing ? draft.city : user.city}
            editing={editing}
            name="city"
            onChange={handleChange}
          />
          <FieldRow
            label="Blood type"
            icon={Droplet}
            value={editing ? draft.bloodType : user.bloodType}
            editing={editing}
            name="bloodType"
            options={BLOOD_TYPES}
            onChange={handleChange}
          />
        </div>

        {/* donation history */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold mb-3" style={{ color: C.ink, fontFamily: FB }}>
            Donation history
          </h2>
          <DonationHistory donations={user.donations} />
          <p className="text-xs mt-3" style={{ color: C.sub, fontFamily: FB }}>
            {nextEligibleText(user.donations)}
          </p>
        </div>
      </main>
    </div>
  );
}