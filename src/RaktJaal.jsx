import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Heart,
  Activity,
  MapPin,
  Quote,
  TestTube2,
  Syringe,
  ShieldCheck,
  Send,
  Sparkles,
} from "lucide-react";


const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes float { 0%,100% { transform: translateY(0px) rotate(var(--r,0deg)); } 50% { transform: translateY(-14px) rotate(var(--r,0deg)); } }
@keyframes pulseRing { 0% { transform: scale(0.9); opacity: 0.6; } 70% { transform: scale(1.6); opacity: 0; } 100% { opacity: 0; } }
@keyframes dash { to { stroke-dashoffset: 0; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dropFall { 0% { transform: translate(-50%, -160%) scale(0.6); opacity: 0; } 40% { opacity: 1; } 100% { transform: translate(-50%, 40%) scale(1); opacity: 0; } }
@keyframes dropRipple { 0% { transform: translate(-50%, -50%) scale(0); opacity: 0.45; } 100% { transform: translate(-50%, -50%) scale(6); opacity: 0; } }
@keyframes fillWash { from { transform: translateY(100%); } to { transform: translateY(0%); } }
`;

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

const IMG = {
  iv: "https://plus.unsplash.com/premium_vector-1720520991612-8bd84487af6f?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  tube: "https://images.unsplash.com/photo-1639772823849-6efbd173043c?fm=jpg&q=80&w=1200&auto=format&fit=crop",
  syringe: "https://images.unsplash.com/photo-1542884841-9f546e727bca?fm=jpg&q=80&w=1600&auto=format&fit=crop",
};

const FD = "'Plus Jakarta Sans', sans-serif";
const FB = "'Manrope', sans-serif";
const FM = "'JetBrains Mono', monospace";

/* ---------------- Scroll reveal ---------------- */

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(.22,.61,.36,1) ${delay}s, transform 0.7s cubic-bezier(.22,.61,.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- Count up ---------------- */

function CountUp({ target, suffix = "", duration = 1400 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

/* ---------------- Brand mark (professional, no cartoon face) ---------------- */

function BrandMark({ size = 36, ring = true }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ring && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: C.brick, animation: "pulseRing 2.4s ease-out infinite" }}
        />
      )}
      <svg width={size} height={size} viewBox="0 0 40 40" className="relative">
        <path
            d="M20 3 C28 15 34 24 34 30 C34 36 27.7 40 20 40 C12.3 40 6 36 6 30 C6 24 12 15 20 3 Z"
             fill={C.brick}   // was fill={C.ink}
        />
        <rect x="17" y="18" width="6" height="16" rx="1.5" fill="#fff" />
        <rect x="12" y="23" width="16" height="6" rx="1.5" fill="#fff" />
      </svg>
    </div>
  );
}
function Nav() {
  return (
    <div className="sticky top-2 z-50 mx-4 md:max-w-7xl md:mx-auto">
      <header 
        className="flex items-center justify-between px-2.5 py-1.5 rounded-full bg-white/80 backdrop-blur-lg border border-white/60 transition-all duration-300"
      >
        <a href="#top" className="flex items-center gap-2 pl-2">
          <BrandMark size={22} ring={false} /> 
          <span className="text-[16px] font-bold tracking-tight text-neutral-900">
            RaktJaal
          </span>
        </a>
        
        <nav className="hidden md:flex items-center gap-7 text-[14px] font-medium text-neutral-600">
          <a href="#how" className="hover:text-neutral-900 transition-colors duration-200">How it works</a>
          <a href="#built" className="hover:text-neutral-900 transition-colors duration-200">What's built</a>
          <a href="#why" className="hover:text-neutral-900 transition-colors duration-200">Why this matters</a>
          <a href="#who" className="hover:text-neutral-900 transition-colors duration-200">Who this is built for</a>
          
          <div className="w-[1px] h-3.5 bg-neutral-300"></div>
          
          <a href="#faq" className="hover:text-neutral-900 transition-colors duration-200">FAQs</a>
        </nav>

        <div className="flex items-center gap-1.5 pr-0.5">
          <Link
            to="/login"
            className="hidden sm:block text-[14px] px-3.5 py-1.5 rounded-full font-medium bg-black/5 text-neutral-900 hover:bg-black/10 transition-colors duration-200"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="text-[14px] px-4 py-1.5 rounded-full font-medium bg-black text-white hover:bg-neutral-800 transition-all duration-200 active:scale-95"
          >
            Get started
          </Link>
        </div>
      </header>
    </div>
  );
}
/* ---------------- Hero ---------------- */

function FloatingChip({ icon: Icon, style, delay = "0s" }) {
  return (
    <div
      className="absolute w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
      style={{
        background: "#fff",
        border: `1px solid ${C.ink}14`,
        animation: `float 5s ease-in-out ${delay} infinite`,
        ...style,
      }}
    >
      <Icon size={19} color={C.brick} />
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="max-w-6xl mx-auto px-6 md:px-10 pt-14 md:pt-20 pb-24 grid md:grid-cols-2 gap-16 items-center">
      <Reveal>
        
        <h1
          className="text-[2.6rem] leading-[1.08] md:text-6xl md:leading-[1.05] font-medium tracking-tight"
          style={{ color: C.ink, fontFamily: FD }}
        >
          Every drop finds
          <br />
          somewhere to
          <br />
          <span style={{ color: C.brick }}>go — instantly.</span>
        </h1>
        <p className="mt-6 text-lg max-w-md" style={{ color: C.sub, fontFamily: FB }}>
          RaktJaal replaces the WhatsApp-forward-and-pray routine with targeted,
          real-time alerts — matched by blood type, distance, and urgency.
        </p>

        

        
      </Reveal>

      <Reveal delay={0.15}>
        <div className="relative">
          <div className="rounded-[2rem] overflow-hidden relative" style={{ boxShadow: "0 30px 60px -20px rgba(20,17,15,0.35)" }}>
            <img src={IMG.iv} alt="IV line, ready for a transfusion" className="w-full h-[420px] object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(20,17,15,0.65) 100%)" }} />
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-xs" style={{ fontFamily: FM }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#5FD07A" }} />
                MATCH FOUND · NEAR YOU
              </div>
              <div className="px-2.5 py-1 rounded-full text-xs text-white" style={{ background: "#FFFFFF26", fontFamily: FM }}>
                Savior
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Trust strip ---------------- */

function TrustStrip() {
  const items = [
    { icon: ShieldCheck, label: "BE SOMEONE'S LIFELINE BY DONATING BLOOD" },
    { icon: Heart, label: "LIFE FLOWS FROM THOSE WHO CARE" },
    { icon: Droplet, label: "PRIVACY WITHOUT COMPROMISE" },
  ];
  return (
    <section style={{ borderTop: `1px solid ${C.ink}12`, borderBottom: `1px solid ${C.ink}12` }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex flex-wrap gap-x-10 gap-y-3 justify-center md:justify-between">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={15} color={C.brick} />
            <span className="text-xs uppercase tracking-wide" style={{ color: C.sub, fontFamily:  "'Sora', sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Mock window ---------------- */

function MockWindow({ children, tint = "#F7F5F2" }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.ink}1A`, background: "#fff", boxShadow: "0 16px 32px -18px rgba(20,17,15,0.2)" }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${C.ink}10` }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "#FF5F57" }} />
        <span className="w-2 h-2 rounded-full" style={{ background: "#FEBC2E" }} />
        <span className="w-2 h-2 rounded-full" style={{ background: "#28C840" }} />
      </div>
      <div style={{ background: tint }} className="p-4">{children}</div>
    </div>
  );
}

function FeatureBlock({ eyebrowIcon: Icon, eyebrow, title, desc, tint, children }) {
  return (
    <Reveal>
      <div className="rounded-3xl p-8 md:p-10 h-full flex flex-col transition-transform duration-300 hover:-translate-y-1.5" style={{ background: tint }}>
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 text-xs mb-3" style={{ color: C.brickDark, opacity: 0.8, fontFamily: FM }}>
            <Icon size={13} /> {eyebrow}
          </div>
          <h3 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: C.ink, fontFamily: FD }}>{title}</h3>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: C.sub, fontFamily: FB }}>{desc}</p>
        </div>
        <div className="mt-auto">{children}</div>
      </div>
    </Reveal>
  );
}

function FeatureGrids() {
  return (
    <section id="built" className="max-w-6xl mx-auto px-6 md:px-10 py-8">
      <Reveal>
        <div className="text-center max-w-lg mx-auto mb-12">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.brick, fontFamily: FM }}>What's built</p>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight" style={{ color: C.ink, fontFamily: FD }}>
            The mechanics that turn a request into a match
          </h2>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <FeatureBlock eyebrowIcon={Droplet} eyebrow="Requests" title="You Post, RaktJaal Alerts" desc="Blood type, units, hospital. That's it — matching happens automatically, in the background." tint={C.peach}>
          <MockWindow>
            <div className="space-y-2" style={{ fontFamily: FB }}>
              <div className="text-xs" style={{ color: C.sub }}>New request</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-md text-xs text-white" style={{ background: C.brick }}>O-negative</span>
                <span className="px-2 py-1 rounded-md text-xs" style={{ background: "#F0EDE9", color: C.ink }}>2 units</span>
              </div>
              <div className="text-xs mt-1" style={{ color: C.ink }}>Kanpur District Hospital</div>
            </div>
          </MockWindow>
        </FeatureBlock>

        <FeatureBlock eyebrowIcon={Activity} eyebrow="Emergency Mode" title="Countdown, Not Chaos" desc="Life-critical requests get a red flag and a live timer, sorted above everything else." tint={C.lilac}>
          <MockWindow>
            <div className="text-center" style={{ fontFamily: FB }}>
              <span className="inline-block px-2 py-1 rounded-md text-xs text-white mb-2" style={{ background: C.brick }}>EMERGENCY</span>
              <div className="text-2xl font-semibold" style={{ color: C.ink, fontFamily: FM }}>02 : 41 : 09</div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>until requested by</div>
            </div>
          </MockWindow>
        </FeatureBlock>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <FeatureBlock eyebrowIcon={MapPin} eyebrow="Live Feed" title="Sorted By Distance & Urgency" desc="The nearest, most time-critical request always surfaces first — no scrolling required." tint={C.mint}>
          <MockWindow>
            <div className="space-y-1.5" style={{ fontFamily: FB }}>
              {["1.2 km · B+ · Urgent", "3.8 km · O+ · Standard", "5.1 km · A- · Standard"].map((r) => (
                <div key={r} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: "#F0EDE9" }}>
                  <span style={{ color: C.ink }}>{r}</span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.brick }} />
                </div>
              ))}
            </div>
          </MockWindow>
        </FeatureBlock>

        <FeatureBlock eyebrowIcon={Heart} eyebrow="One Tap" title="Accept, Then Connect" desc="Tap “I can help” and contact details unlock in-app. No public numbers, ever." tint={C.sky}>
          <MockWindow>
            <div className="flex items-center justify-between" style={{ fontFamily: FB }}>
              <div className="text-xs" style={{ color: C.ink }}>Ravi wants to help</div>
              <button className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: C.ink }}>I can help</button>
            </div>
          </MockWindow>
        </FeatureBlock>
      </div>

      <Reveal>
        <div className="rounded-3xl overflow-hidden grid md:grid-cols-2" style={{ background: C.ink }}>
          <div className="p-10 md:p-12 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: C.blush, fontFamily: FM }}>
              <TestTube2 size={13} /> VERIFIED PROFILES
            </div>
            <h3 className="text-2xl md:text-3xl font-medium tracking-tight mb-3" style={{ color: "#fff", fontFamily: FD }}>
              Every match is backed by a real eligibility record
            </h3>
            <p className="text-sm max-w-sm" style={{ color: "#FFFFFFB3", fontFamily: FB }}>
              Blood type, last donation date, and eligibility window — kept accurate
              so a donor who accepts can actually give.
            </p>
          </div>
          <div className="relative min-h-[260px]">
            <img src={IMG.tube} alt="A test tube sample being handled in a lab" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,17,15,0.55), transparent 40%)" }} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorks() {
  const steps = [
    { icon: Droplet, title: "Post", desc: "A requester enters blood type, units needed, and hospital location." },
    { icon: MapPin, title: "Match", desc: "The system finds donors of a matching type within 10km." },
    { icon: Sparkles, title: "Notify", desc: "Matched donors get an alert — no manual sharing, no guesswork." },
    { icon: Heart, title: "Connect", desc: "A donor accepts, and the requester instantly sees name, distance, and phone." },
  ];
  return (
    <section id="how" className="max-w-6xl mx-auto px-6 md:px-10 py-24 grid md:grid-cols-2 gap-14 items-center">
      <Reveal>
        <div className="relative rounded-[2rem] overflow-hidden" style={{ boxShadow: "0 30px 60px -25px rgba(20,17,15,0.35)" }}>
          <img src={IMG.syringe} alt="Close-up of a syringe used for a blood draw" className="w-full h-[440px] object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,17,15,0.1), rgba(20,17,15,0.55))" }} />
          <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-white" style={{ background: "#FFFFFF26", fontFamily: FM }}>
            <Syringe size={13} /> READY FOR TRANSFER
          </div>
        </div>
      </Reveal>

      <div>
        <Reveal>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: C.brick, fontFamily: FM }}>How it works</p>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-10" style={{ color: C.ink, fontFamily: FD }}>
            From request to donor, in four steps
          </h2>
        </Reveal>
        <div className="flex flex-col gap-8">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: C.blush }}>
                  <Icon size={19} color={C.brick} />
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.sub, fontFamily: FM }}>{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="text-lg font-semibold" style={{ color: C.ink, fontFamily: FD }}>{title}</h3>
                  <p className="text-sm mt-1 max-w-sm" style={{ color: C.sub, fontFamily: FB }}>{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Narrative / stats ---------------- */

function VitalsLine() {
  return (
    <svg viewBox="0 0 400 60" className="w-full h-14" preserveAspectRatio="none">
      <polyline
        points="0,30 60,30 75,10 90,50 105,30 160,30 175,15 190,45 205,30 400,30"
        fill="none" stroke={C.brick} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 700, strokeDashoffset: 700, animation: "dash 3.2s ease-in-out infinite" }}
      />
    </svg>
  );
}

function Narrative() {
  return (
    <section id="why" className="py-24 relative overflow-hidden" style={{ background: C.ink }}>
      <div className="max-w-4xl mx-auto px-6 md:px-10 text-center relative">
        <Reveal>
          <p className="text-xs uppercase tracking-wider mb-4" style={{ color: C.blush, fontFamily: FM }}>Why this matters</p>
          <h2 className="text-2xl md:text-4xl font-medium tracking-tight mb-8" style={{ color: "#fff", fontFamily: FD }}>
            Most urgent requests are seen too late — not because no one would help,
            but because the right person never saw it.
          </h2>
          <VitalsLine />
          <div className="grid grid-cols-3 gap-6 mt-8">
            {[[60, "%", "requests seen too late"], [10, "km", "matching radius"], [5, "s", "target notify time"]].map(([n, s, l]) => (
              <div key={l}>
                <div className="text-3xl md:text-4xl font-semibold" style={{ color: "#fff", fontFamily: FM }}>
                  <CountUp target={n} suffix={s} />
                </div>
                <div className="text-xs mt-1.5" style={{ color: C.blush, fontFamily: FB }}>{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

function Testimonials() {
  const items = [
    { 
      initials: "D", 
      tag: "A donor", 
      quote: "I didn't know someone nearby needed my type until the alert came through.", 
      bg: C.peach,
      img: "https://plus.unsplash.com/premium_vector-1765379372386-b791928e328c?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    { 
      initials: "F", 
      tag: "Receiver", 
      quote: "We stopped refreshing WhatsApp groups and just waited for a match instead.", 
      bg: C.mint,
      img: "https://plus.unsplash.com/premium_vector-1764834267224-9c5aae78e152?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    { 
      initials: "H", 
      tag: "A hospital coordinator", 
      quote: "One request, sent once, reaching only donors who actually match.", 
      bg: C.sky,
      img: "https://plus.unsplash.com/premium_vector-1720636314575-748da2042f21?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    { 
      initials: "D", 
      tag: "A repeat donor", 
      quote: "I get asked only when my exact type is needed nearby — never spam.", 
      bg: C.blush,
      img: "https://plus.unsplash.com/premium_vector-1765363113016-8cc31243202d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjR8fGJsb29kJTIwZG9uYXRlfGVufDB8fDB8fHwx"
    },
  ];
  const [start, setStart] = useState(0);
  const visible = 3;
  const max = Math.max(0, items.length - visible); // reachable start positions: 0..max

  return (
    <section id="who" className="max-w-6xl mx-auto px-6 md:px-10 py-24">
      <Reveal>
        <h2 className="text-3xl md:text-4xl text-center font-medium tracking-tight mb-12" style={{ color: C.ink, fontFamily: FD }}>
          Who this is built for
        </h2>
      </Reveal>

      <div className="overflow-hidden py-2">
        <div className="flex gap-5 transition-transform duration-500" style={{ transform: `translateX(calc(-${start} * (100% + 20px) / ${visible}))` }}>
          {items.map((t, i) => (
            <div key={i} className="shrink-0" style={{ width: `calc((100% - ${(visible - 1) * 20}px) / ${visible})` }}>
              <div className="rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1" style={{ border: `1px solid ${C.ink}14` }}>
                
                {/* Updated this div below to use the images */}
                <div 
                  className="aspect-video w-full flex items-center justify-center relative"
                  style={{ 
                    backgroundImage: `url('${t.img}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: t.bg 
                  }}
                >
                
                  <Quote size={16} className="absolute top-3 left-3" color="#550000" fill="#550000" />
                </div>

                <div className="p-4" style={{ fontFamily: FB }}>
                  <p className="text-sm" style={{ color: C.ink }}>{t.quote}</p>
                  <p className="text-xs mt-2" style={{ color: C.sub }}>{t.tag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-6">
        <button onClick={() => setStart((s) => Math.max(0, s - 1))} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F2EF] disabled:opacity-30 disabled:cursor-not-allowed" style={{ border: `1px solid ${C.ink}33` }} disabled={start === 0}>
          <ChevronLeft size={16} color={C.ink} />
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: max + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStart(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i === start ? C.ink : `${C.ink}33` }}
            />
          ))}
        </div>
        <button onClick={() => setStart((s) => Math.min(max, s + 1))} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F4F2EF] disabled:opacity-30 disabled:cursor-not-allowed" style={{ border: `1px solid ${C.ink}33` }} disabled={start === max}>
          <ChevronRight size={16} color={C.ink} />
        </button>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  const faqs = [
    ["How does matching work?", "You post a blood type, unit count, and hospital location. RaktJaal finds donors of that exact type within a set radius and alerts them directly."],
    ["Is my contact info public?", "No. Details only unlock in-app once a donor taps \u201cI can help\u201d — nothing is visible beforehand."],
    ["Do I need to be a registered donor?", "Yes, a short profile with blood type and last donation date, so matches stay accurate and eligible."],
    ["How is urgency decided?", "The requester marks it. Emergency requests get a countdown timer and sit above standard ones in the feed."],
    ["Is RaktJaal live yet?", "Not yet — this is a working student prototype. We're building toward a pilot in one city first."],
    ["Do hospitals pay to use this?", "The plan is to keep it free for requesters and donors. Hospital verification details are still being worked out."],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="max-w-2xl mx-auto px-6 md:px-10 py-24">
      <Reveal>
        <h2 className="text-3xl font-medium tracking-tight text-center mb-2" style={{ color: C.ink, fontFamily: FD }}>FAQ</h2>
        <p className="text-sm text-center mb-10" style={{ color: C.sub, fontFamily: FB }}>Anything else, reach the team directly.</p>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="flex flex-col">
          {faqs.map(([q, a], i) => (
            <div key={q} style={{ borderBottom: `1px solid ${C.ink}14` }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between py-4 text-left group">
                <span className="text-sm group-hover:opacity-70 transition-opacity" style={{ color: C.ink, fontFamily: FB, fontWeight: 600 }}>{q}</span>
                <ChevronDown size={16} color={C.ink} style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.25s" }} />
              </button>
              {open === i && (
                <p className="text-sm pb-4 pr-8" style={{ color: C.sub, fontFamily: FB, animation: "fadeUp 0.35s ease" }}>{a}</p>
              )}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* get started function for button*/

function GetStartedButton() {
  const navigate = useNavigate();
  // Renamed to 'isActive' to encompass both mouse hover and keyboard focus
  const [isActive, setIsActive] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef(null);

  const drops = [
    { left: "18%", delay: "0s", size: 6 },
    { left: "35%", delay: "0.15s", size: 5 },
    { left: "52%", delay: "0.3s", size: 7 },
    { left: "68%", delay: "0.1s", size: 5 },
    { left: "83%", delay: "0.25s", size: 6 },
  ];

  // Cleanup timeout to prevent memory leaks if component unmounts early
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = (e) => {
    e.preventDefault();
    if (isNavigating) return;
    
    setIsNavigating(true);
    setIsActive(false); // Cleanly stop the droplet animation
    
    // Add slight buffer (20ms) over the 500ms animation
    timeoutRef.current = setTimeout(() => {
      navigate("/register");
    }, 520);
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      disabled={isNavigating}
      className={`
        relative overflow-hidden px-7 py-3 rounded-full text-sm text-white 
        transition-transform duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50
        ${!isNavigating ? 'hover:scale-[1.04] active:scale-95 cursor-pointer' : 'cursor-default'}
      `}
      style={{ 
        background: C.brick, 
        fontFamily: FB, 
        fontWeight: 600 
      }}
      aria-live="polite"
    >
      {/* multiple subtle droplets falling in on hover/focus, staggered */}
      {isActive && !isNavigating && drops.map((d, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-full pointer-events-none"
          style={{
            left: d.left,
            width: d.size,
            height: d.size * 1.3,
            background: "#fff",
            opacity: 0.5,
            animation: `dropFall 1s ease-in ${d.delay} infinite`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* click: a red wash rises to fill/confirm before navigating */}
      {isNavigating && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ 
            background: C.brickDark, 
            animation: "fillWash 0.5s cubic-bezier(.22,.61,.36,1) forwards" 
          }}
          aria-hidden="true"
        />
      )}

      {/* click: ripple ring from the center */}
      {isNavigating && (
        <span
          // Added translate rules to truly center the ripple origin
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ 
            background: "#fff", 
            width: "16px",
            height: "16px",
            animation: "dropRipple 0.5s ease-out forwards" 
          }}
          aria-hidden="true"
        />
      )}

      {/* Added min-width to prevent button jumping when text length changes, and z-10 to stay above wash */}
      <span className="relative z-10 flex items-center justify-center min-w-[110px]">
        {isNavigating ? "Taking you there…" : "Get Started"}
      </span>
    </button>
  );
}

/* ---------------- CTA ---------------- */

function CTA() {
  return (
    <section className="pt-16 pb-20 text-center rounded-t-[3rem] mx-4 md:mx-10" style={{ background: C.blush }}>
      <Reveal>
        <div className="flex justify-center mb-5">
          <BrandMark size={44} />
        </div>
        <h2 className="text-3xl md:text-4xl font-medium tracking-tight" style={{ color: C.ink, fontFamily: FD }}>Ready to be found?</h2>
        <p className="text-sm mt-3 max-w-sm mx-auto" style={{ color: C.sub, fontFamily: FB }}>
          Try the coverage check above, or reach out if you want to help pilot RaktJaal in your city.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <GetStartedButton />
        </div>
      </Reveal>
    </section>
  );
}



/* for github and linkedin icons*/
function GithubIcon({ size = 15, color = "#fff", opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} opacity={opacity}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function LinkedinIcon({ size = 15, color = "#fff", opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} opacity={opacity}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  const [showLinks, setShowLinks] = useState(false);
  const timerRef = useRef(null);

  // Starts the 5-second countdown to close the window
  const startTimer = () => {
    timerRef.current = setTimeout(() => {
      setShowLinks(false);
    }, 3000);
  };

  // Stops the countdown
  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Automatically start the timer whenever the popup opens
  useEffect(() => {
    if (showLinks) {
      startTimer();
    }
    // Cleanup function to clear the timer if the component unmounts
    return () => clearTimer();
  }, [showLinks]);

  const team = [
    { name: "Aayush Singh", linkedin: "https://www.linkedin.com/in/aayush-singh-b357152b8/" },
    { name: "Agraj Singh", linkedin: "https://www.linkedin.com/in/thattimelessman" },
    { name: "Ananya Arora", linkedin: "https://www.linkedin.com/in/ananya-arora-a0b925327/" },
    { name: "Akhil Kumar Yadav", linkedin: null },
    { name: "Mohammad Aqif Khan", linkedin: null },
  ];
  
  return (
    <footer style={{ background: C.ink }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 grid md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BrandMark size={28} ring={false} />
            <span className="text-sm text-white" style={{ fontFamily: FD }}>RaktJaal</span>
          </div>
          <p className="text-xs" style={{ color: "#FFFFFF73", fontFamily: FB }}>
            PSIT Kanpur <br/>
            Dept. of Data Science <br/>
            Mini Project 2026–27
          </p>
        </div>

        <div id="team">
          <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "#FFFFFF80", fontFamily: FM }}>Team CS-DS-3A-05</p>
          <div className="flex flex-col gap-2.5 text-sm" style={{ fontFamily: FB }}>
            {team.map((m) => (
              <span key={m.name} className="text-white opacity-70">
                {m.name}
              </span>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "#FFFFFF80", fontFamily: FM }}>Connect</p>
          <div className="flex gap-4">
            <div className="relative">
              <button 
                onClick={() => {
                  if (showLinks) {
                    setShowLinks(false);
                    clearTimer();
                  } else {
                    setShowLinks(true);
                  }
                }}
                className="transition-opacity hover:opacity-100 opacity-60 flex items-center focus:outline-none"
              >
                <Send size={16} color="#fff" />
              </button>

              {showLinks && (
                <div 
                  onMouseEnter={clearTimer} // Pause timer when mouse enters
                  onMouseLeave={startTimer} // Restart timer when mouse leaves
                  className="absolute bottom-full left-0 mb-3 w-48 rounded-xl shadow-2xl py-2 z-50 overflow-hidden"
                  style={{ background: "#27272A", border: "1px solid #3F3F46", animation: "fadeUp 0.2s ease" }}
                >
                  <p className="text-[10px] uppercase tracking-wider px-3.5 mb-1.5" style={{ color: "#FFFFFF80", fontFamily: FM }}>
                    LinkedIn Profiles
                  </p>
                  <div className="flex flex-col">
                    {team.filter(m => m.linkedin).map(m => (
                      <a
                        key={m.name}
                        href={m.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                        style={{ fontFamily: FB }}
                      >
                        <LinkedinIcon size={13} /> {m.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex flex-wrap gap-3 justify-between items-center" style={{ borderTop: "1px solid #FFFFFF1A" }}>
        <span className="text-xs" style={{ color: "#FFFFFF66", fontFamily: FB }}>
          © 2026 RaktJaal
        </span>
        
        <a
          href="https://github.com/thattimelessman/RaktJaal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-100"
          style={{ color: "#FFFFFF66", fontFamily: FB }}
        >
          <GithubIcon size={13} /> View on GitHub
        </a>
      </div>
    </footer>
  );
}

/* ---------------- Root ---------------- */

export default function RaktJaalPro() {
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      <Nav />
      <Hero />
      <TrustStrip />
      <FeatureGrids />
      <HowItWorks />
      <Narrative />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}