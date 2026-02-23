import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ListFilter, BarChart3, Wrench, QrCode, Megaphone } from 'lucide-react';

/* ─── GOOGLE FONTS INJECTION ─── */
const FontInjector = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Zen+Kaku+Gothic+New:wght@300;400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
};

/* ─── GLOBAL STYLES ─── */
const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1714;
    --ash: #6b6560;
    --fog: #c8c0b5;
    --sand: #e8e0d5;
    --parchment: #f2ede6;
    --warm-white: #faf7f3;
    --clay: #b8825a;
    --moss: #7a8c6e;
    --serif: 'Cormorant Garamond', Georgia, serif;
    --sans: 'Zen Kaku Gothic New', sans-serif;
  }
  html { scroll-behavior: smooth; }
  body { margin: 0; padding: 0; background: var(--warm-white); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes floatPhone {
    0%, 100% { transform: translateY(0px) rotate(-2deg); }
    50%       { transform: translateY(-14px) rotate(-2deg); }
  }
  @keyframes ripple {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50%       { transform: scale(1.06); opacity: 0.3; }
  }
  @keyframes scanLine {
    0%   { top: 10%; }
    100% { top: 85%; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes growH {
    from { width: 0; }
    to   { width: 100%; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

/* ─── STYLE INJECTION ─── */
const StyleInjector = () => {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalCSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

/* ─── REVEAL HOOK ─── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ─── QR CODE SVG (dynamic pixel grid) ─── */
function QRCode({ size = 100 }) {
  const src = "/images/logo/qr-code.png";
  return (
    <img
      src={src}
      alt="WEBT-TRaC QR"
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, objectFit: "contain" }}
    />
  );
}

/* ─── PHONE MOCKUP ─── */
function PhoneMockup({ activeScreen = 0 }) {
  const screens = [
    {
      label: "Driver",
      bg: "linear-gradient(160deg, #7a8c6e 0%, #4a5c3e 100%)",
      image: "/images/product/driver.jpg",
      title: "Driver",
      sub: "Driver view",
    },
    {
      label: "Guest",
      bg: "linear-gradient(160deg, #b8825a 0%, #7a4c2e 100%)",
      image: "/images/product/guest.jpg",
      title: "Guest",
      sub: "Guest view",
    },
    {
      label: "Operator",
      bg: "linear-gradient(160deg, #808898 0%, #4a5060 100%)",
      image: "/images/product/operator.jpg",
      title: "Operator",
      sub: "Operator view",
    },
  ];

  const s = screens[activeScreen % screens.length];

  return (
    <div
      style={{
        width: 220,
        height: 440,
        background: "#1a1714",
        borderRadius: 36,
        padding: 3,
        boxShadow:
          "0 60px 120px rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: "floatPhone 6s ease-in-out infinite",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Side buttons */}
      <div style={{ position: "absolute", left: -3, top: 80, width: 3, height: 32, background: "#2d2825", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 122, width: 3, height: 32, background: "#2d2825", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: -3, top: 100, width: 3, height: 50, background: "#2d2825", borderRadius: "0 2px 2px 0" }} />

      {/* Screen — image only */}
      <div style={{ width: "100%", height: "100%", borderRadius: 34, overflow: "hidden", position: "relative" }}>
        <img
          src={s.image}
          alt={s.label}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}

/* ─── QR PANEL ─── */
function QRPanel() {
  const [scanning, setScanning] = useState(false);

  return (
    <div style={{
      background: "var(--warm-white)",
      border: "1px solid var(--sand)",
      borderRadius: 20,
      padding: 28,
      width: 200,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
    }}>
      <p style={{ fontFamily: "var(--sans)", fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--ash)" }}>
        Scan to View App
      </p>

      {/* QR wrapper */}
      <div
        style={{ position: "relative", cursor: "pointer", padding: 8, background: "#fff", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
        onMouseEnter={() => setScanning(true)}
        onMouseLeave={() => setScanning(false)}
      >
        <QRCode size={120} />

        {/* Scan line animation */}
        {scanning && (
          <div style={{
            position: "absolute", left: 8, right: 8, top: "10%",
            height: 2,
            background: "linear-gradient(90deg, transparent, var(--clay), transparent)",
            animation: "scanLine 1.2s linear infinite",
            borderRadius: 1,
          }} />
        )}

        {/* Corner brackets */}
        {[{top:4,left:4},{top:4,right:4},{bottom:4,left:4},{bottom:4,right:4}].map((pos,i) => (
          <div key={i} style={{
            position: "absolute", ...pos,
            width: 14, height: 14,
            borderTop: i < 2 ? `2px solid var(--clay)` : "none",
            borderBottom: i >= 2 ? `2px solid var(--clay)` : "none",
            borderLeft: (i === 0 || i === 2) ? `2px solid var(--clay)` : "none",
            borderRight: (i === 1 || i === 3) ? `2px solid var(--clay)` : "none",
          }} />
        ))}
      </div>

      <p style={{ fontFamily: "var(--sans)", fontSize: 7.5, letterSpacing: "0.1em", color: "var(--fog)", textAlign: "center", lineHeight: 1.6 }}>
        WEBT-TRaC Digital App<br />2026
      </p>

      {/* Store badges */}
      <div style={{ display: "flex", gap: 8 }}>
        {["WEBT-TRaC", "Learn More"].map((label, i) => (
          <div key={i} style={{
            padding: "5px 10px",
            background: "var(--ink)",
            borderRadius: 6,
            fontFamily: "var(--sans)",
            fontSize: 7,
            letterSpacing: "0.1em",
            color: "var(--warm-white)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TEAM CARD ─── */
function TeamCard({ member, delay, visible }) {
  const avatarColors = [
    "linear-gradient(145deg, #7a8c6e, #4a5c3e)",
    "linear-gradient(145deg, #b8825a, #7a4c2e)",
    "linear-gradient(145deg, #808898, #4a5060)",
    "linear-gradient(145deg, #c8a882, #8c6040)",
  ];

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
    }}>
      {/* Avatar */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: avatarColors[member.colorIdx],
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}>
        {member.image ? (
          <img src={member.image} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        ) : member.emoji}
      </div>
      <div style={{
        width: 30,
        height: 1,
        background: "var(--clay)",
        marginBottom: 12,
        transition: `width 0.8s ease ${delay + 200}ms`,
      }} />
      <p style={{ fontFamily: "var(--serif)", fontSize: "1.25rem", fontWeight: 300, color: "var(--warm-white)", marginBottom: 4 }}>
        {member.name}
      </p>
      <p style={{ fontFamily: "var(--sans)", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--clay)", marginBottom: 12 }}>
        {member.role}
      </p>
      <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", lineHeight: 1.8, color: "var(--ash)", maxWidth: 220 }}>
        {member.bio}
      </p>
    </div>
  );
}

/* ─── CONTACT FORM ─── */
function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(null);

  const inputStyle = (field) => ({
    width: "100%",
    padding: "14px 0",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${focused === field ? "var(--clay)" : "var(--sand)"}`,
    fontFamily: "var(--sans)",
    fontSize: "0.875rem",
    color: "var(--ink)",
    outline: "none",
    transition: "border-color 0.3s",
    letterSpacing: "0.03em",
  });

  return sent ? (
    <div style={{ textAlign: "center", padding: "3rem 0", animation: "fadeIn 0.8s ease forwards" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
      <p style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", fontWeight: 300, color: "var(--ink)", marginBottom: 8 }}>Message received</p>
      <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", color: "var(--ash)", letterSpacing: "0.1em" }}>We'll respond within 24 hours, quietly.</p>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {[
        { key: "name", label: "Your Name", type: "text" },
        { key: "email", label: "Email Address", type: "email" },
      ].map(({ key, label, type }) => (
        <div key={key} style={{ marginBottom: 24 }}>
          <label style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--ash)", display: "block", marginBottom: 4 }}>
            {label}
          </label>
          <input
            type={type}
            value={form[key]}
            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            onFocus={() => setFocused(key)}
            onBlur={() => setFocused(null)}
            style={inputStyle(key)}
          />
        </div>
      ))}
      <div style={{ marginBottom: 40 }}>
        <label style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--ash)", display: "block", marginBottom: 4 }}>
          Message
        </label>
        <textarea
          rows={5}
          value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          onFocus={() => setFocused("message")}
          onBlur={() => setFocused(null)}
          style={{ ...inputStyle("message"), resize: "none", display: "block" }}
        />
      </div>
      <button
        onClick={() => setSent(true)}
        style={{
          alignSelf: "flex-start",
          padding: "14px 48px",
          background: "var(--ink)",
          color: "var(--warm-white)",
          fontFamily: "var(--sans)",
          fontSize: "0.65rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          border: "none",
          cursor: "pointer",
          transition: "background 0.3s, letter-spacing 0.3s, padding 0.3s",
        }}
        onMouseEnter={e => { e.target.style.background = "var(--clay)"; e.target.style.letterSpacing = "0.45em"; }}
        onMouseLeave={e => { e.target.style.background = "var(--ink)"; e.target.style.letterSpacing = "0.3em"; }}
      >
        Send
      </button>
    </div>
  );
}

/* ─── NAV ─── */
function Nav({ activeSection }) {
  const links = ["Home", "About", "Contact"];
  const ids = ["home", "about", "contact"];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0,
      zIndex: 200,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1.6rem 4rem",
      background: "rgba(250,247,243,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(232,224,213,0.5)",
    }}>
      <a href="#home" style={{ textDecoration: "none" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", fontWeight: 300, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--ink)" }}>
          WEBT-TRaC
        </span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: "3rem" }}>
        <ul style={{ listStyle: "none", display: "flex", gap: "3rem", margin: 0 }}>
          {links.map((link, i) => (
            <li key={link}>
              <a
                href={`#${ids[i]}`}
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: activeSection === ids[i] ? "var(--clay)" : "var(--ash)",
                  textDecoration: "none",
                  transition: "color 0.3s",
                  paddingBottom: "3px",
                  borderBottom: activeSection === ids[i] ? "1px solid var(--clay)" : "1px solid transparent",
                }}
              >
                {link}
              </a>
            </li>
          ))}
        </ul>
        <Link
          to="/signin"
          style={{
            fontFamily: "var(--sans)",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--warm-white)",
            backgroundColor: "var(--clay)",
            padding: "0.6rem 1.4rem",
            borderRadius: "4px",
            textDecoration: "none",
            transition: "background-color 0.3s, transform 0.2s",
            fontWeight: 400,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "#a06f48";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "var(--clay)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Admin Portal
        </Link>
      </div>
    </nav>
  );
}

/* ─── SECTION LABEL ─── */
const SectionLabel = ({ children }) => (
  <p style={{
    fontFamily: "var(--sans)",
    fontSize: "0.6rem",
    letterSpacing: "0.35em",
    textTransform: "uppercase",
    color: "var(--clay)",
    marginBottom: "2rem",
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
  }}>
    <span style={{ display: "block", width: 30, height: 1, background: "var(--clay)", flexShrink: 0 }} />
    {children}
  </p>
);

/* ─── MAIN APP ─── */
function LandingPage() {
  const [activeSection, setActiveSection] = useState("home");
  const [activeScreen, setActiveScreen] = useState(0);

  // Nav active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { threshold: 0.4 }
    );
    ["home", "about", "contact"].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Auto-rotate phone screen
  useEffect(() => {
    const t = setInterval(() => setActiveScreen(p => (p + 1) % 3), 3000);
    return () => clearInterval(t);
  }, []);

  // Reveal hooks
  const [heroRef, heroVis] = useReveal(0.05);
  const [featRef, featVis] = useReveal();
  const [aboutRef, aboutVis] = useReveal();
  const [contactRef, contactVis] = useReveal();

  const team = [
    { name: "Dr. Rico S. Santos", role: "Technical Advisor", emoji: "🌸", image: "/images/user/doc_rico.jpg",bio: "Expert oversight on research and system architecture, ensuring high academic and technical standards.", colorIdx: 0 },
    { name: "Donn Anthony Baldoza", role: "Lead Developer", emoji: "🌿", image: "/images/user/donpic.png", bio: "The project architect who manages the roadmap, code quality, and technical integration.", colorIdx: 1 },
    { name: "Henrich Lacao", role: "Backend Developer", emoji: "🪷", image: "/images/user/henrich.jpg", bio: "Builds the \"mind,\" managing databases, APIs, and the core logic that powers the platform.", colorIdx: 2 },
    { name: "Juliana Mae Ines", role: "UX & Design", emoji: "✨", image: "/images/user/inespic.png", bio: "Crafts the visual experience, ensuring the app is intuitive and accessible for drivers and commuters.", colorIdx: 3 },
  ];

  const features = [
    { icon: <ShieldCheck size={28} />, label: "Regulatory Platform", desc: "A simple local interface for registering drivers, logging incidents, and sharing compliance data with the TODA." },
    { icon: <ListFilter size={28} />, label: "Automated Triage", desc: "Structured triage workflow with human review to prioritize passenger reports for TODA action." },
    { icon: <BarChart3 size={28} />, label: "Compliance Scoring", desc: "A transparent driver scorecard the TODA can use to prioritize inspections and interventions." },
    { icon: <Wrench size={28} />, label: "Predictive Maintenance", desc: "ML models detect early signs of vehicle degradation to reduce reactive repairs and improve driver livelihoods." },
    { icon: <QrCode size={28} />, label: "Verification", desc: "Sentiment Analysis of passenger feedback and driver logs to identify service gaps and improve traceability." },
    { icon: <Megaphone size={28} />, label: "Community Reporting", desc: "A user-friendly channel for commuters to report issues in real time, increasing accountability in dense neighborhoods." },
  ];

  return (
    <div style={{ fontFamily: "var(--sans)", background: "var(--warm-white)", color: "var(--ink)" }}>
      <FontInjector />
      <StyleInjector />
      <Nav activeSection={activeSection} />

      {/* ── HERO ── */}
      <section id="home" ref={heroRef} style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        paddingTop: 80,
        overflow: "hidden",
      }}>
        {/* Left */}
        <div style={{
          background: "var(--sand)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "5rem 5rem 5rem 4rem",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* BG kanji */}
          <div style={{
            position: "absolute",
            top: "5%", right: "5%",
            fontFamily: "var(--serif)",
            fontSize: "22rem",
            color: "rgba(26,23,20,0.04)",
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
            animation: "fadeIn 2s ease forwards",
          }}>
            
          </div>

          <p style={{
            fontFamily: "var(--sans)",
            fontSize: "0.65rem",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "var(--clay)",
            marginBottom: "1.5rem",
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s",
          }}>
            WEBT-TRaC · Powering safer, smarter tricycle transport.
          </p>

          <h1 style={{
            fontFamily: "var(--serif)",
            fontSize: "clamp(2.2rem, 5.5vw, 3.6rem)",
            fontWeight: 300,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.9s ease 0.2s, transform 0.9s ease 0.2s",
          }}>
            WEBT-TRaC: Western Bicutan Tenement Tricycle Regulatory<br />
             and Compliance
          </h1>

          <p style={{
            marginTop: "2rem",
            fontSize: "0.95rem",
            lineHeight: 1.9,
            color: "var(--ash)",
            maxWidth: 520,
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.9s ease 0.35s, transform 0.9s ease 0.35s",
          }}>
           WEBT-TRaC primarily assists the Western Bicutan Tenement Tricycle Operators and Driver's Association (WEBTTODA) by providing digital tools that support regulatory compliance, operational monitoring, and effective communication among drivers, operators, and administrators.
          </p>

          <div style={{
            display: "flex",
            gap: "1rem",
            marginTop: "3rem",
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.9s ease 0.5s, transform 0.9s ease 0.5s",
          }}>
            <a
              href="#contact"
              style={{
                padding: "0.9rem 2.5rem",
                background: "var(--ink)",
                color: "var(--warm-white)",
                fontFamily: "var(--sans)",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                textDecoration: "none",
                transition: "background 0.3s",
              }}
              onMouseEnter={e => e.target.style.background = "var(--clay)"}
              onMouseLeave={e => e.target.style.background = "var(--ink)"}
            >
              Report an Issue
            </a>
            <a
              href="#about"
              style={{
                padding: "0.9rem 2.5rem",
                background: "transparent",
                color: "var(--ink)",
                fontFamily: "var(--sans)",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                textDecoration: "none",
                border: "1px solid var(--fog)",
                transition: "border-color 0.3s, color 0.3s",
              }}
              onMouseEnter={e => { e.target.style.borderColor = "var(--clay)"; e.target.style.color = "var(--clay)"; }}
              onMouseLeave={e => { e.target.style.borderColor = "var(--fog)"; e.target.style.color = "var(--ink)"; }}
            >
              Learn More
            </a>
          </div>

          {/* Stats */}
          <div style={{
            display: "flex",
            gap: "2.5rem",
            marginTop: "4rem",
            paddingTop: "2rem",
            borderTop: "1px solid var(--fog)",
            opacity: heroVis ? 1 : 0,
            transition: "opacity 0.9s ease 0.65s",
          }}>
            {[["Dense Community", "Western Bicutan"],  ["Predictive Maintenance", "Vehicle Health"],["Booking System", "Driver Livelihoods"],].map(([num, label]) => (
              <div key={label}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", fontWeight: 300, color: "var(--ink)", lineHeight: 1 }}>{num}</p>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ash)", marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Phone + QR */}
        <div style={{
          background: "var(--parchment)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "3rem",
          position: "relative",
          overflow: "hidden",
          padding: "4rem 3rem",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", border: "1px solid var(--sand)", animation: "ripple 5s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", border: "1px solid var(--fog)", animation: "ripple 5s ease-in-out infinite 1.5s" }} />

          {/* Screen dot indicators */}
          <div style={{ position: "absolute", bottom: "3rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 10 }}>
            {[0,1,2].map(i => (
              <div
                key={i}
                onClick={() => setActiveScreen(i)}
                style={{
                  width: i === activeScreen ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === activeScreen ? "var(--clay)" : "var(--fog)",
                  cursor: "pointer",
                  transition: "width 0.4s ease, background 0.4s ease",
                }}
              />
            ))}
          </div>

          <PhoneMockup activeScreen={activeScreen} />
          <QRPanel />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section ref={featRef} style={{
        background: "var(--warm-white)",
        padding: "8rem 4rem",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "5rem",
          }}>
            <div>
              <SectionLabel>Key Capabilities</SectionLabel>
              <h2 style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(2rem, 3.5vw, 3.2rem)",
                fontWeight: 300,
                color: "var(--ink)",
                lineHeight: 1.2,
                opacity: featVis ? 1 : 0,
                transform: featVis ? "none" : "translateY(20px)",
                transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
              }}>
                Technology & Approach<br />
                <em style={{ fontStyle: "italic", color: "var(--ash)" }}>Predictive maintenance, Booking system, and community reporting</em>
              </h2>
            </div>
            <p style={{
              fontFamily: "var(--sans)",
              fontSize: "0.8rem",
              lineHeight: 1.9,
              color: "var(--ash)",
              maxWidth: 300,
              opacity: featVis ? 1 : 0,
              transition: "opacity 0.8s ease 0.2s",
            }}>
              Aligned with WEBT-TRaC's mission — every feature exists to serve the Western Bicutan tricycle community.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2px",
          }}>
            {features.map((f, i) => (
              <div
                key={f.label}
                style={{
                  padding: "3rem",
                  background: i % 2 === 0 ? "var(--parchment)" : "var(--sand)",
                  opacity: featVis ? 1 : 0,
                  transform: featVis ? "translateY(0) scale(1)" : "translateY(28px) scale(1)",
                  transition: `opacity 0.8s ease ${i * 80}ms, transform 0.35s ease ${i * 80}ms, box-shadow 0.35s ease ${i * 80}ms`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(0) scale(1.03)"; e.currentTarget.style.boxShadow = "0 30px 80px rgba(0,0,0,0.12)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = featVis ? "translateY(0) scale(1)" : "translateY(28px) scale(1)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.06)" }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "1.2rem" }}>{f.icon}</div>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", fontWeight: 300, marginBottom: "0.75rem" }}>{f.label}</p>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", lineHeight: 1.8, color: "var(--ash)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT (TEAM) ── */}
      <section id="about" ref={aboutRef} style={{
        background: "var(--ink)",
        padding: "9rem 4rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* BG text */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          fontFamily: "var(--serif)",
          fontSize: "22rem",
          color: "rgba(255,255,255,0.02)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}>人</div>

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "5rem" }}>
            <div>
              <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--clay)", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <span style={{ width: 30, height: 1, background: "var(--clay)", display: "block" }} />
                About Us
              </p>
              <h2 style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(2rem, 3.5vw, 3.2rem)",
                fontWeight: 300,
                color: "var(--warm-white)",
                lineHeight: 1.2,
                opacity: aboutVis ? 1 : 0,
                transform: aboutVis ? "none" : "translateY(20px)",
                transition: "opacity 0.8s ease, transform 0.8s ease",
              }}>
                The hands behind<br />
                <em style={{ fontStyle: "italic", color: "var(--clay)" }}>every pixel</em>
              </h2>
            </div>
            <p style={{
              fontFamily: "var(--sans)",
              fontSize: "0.8rem",
              lineHeight: 1.9,
              color: "var(--ash)",
              maxWidth: 300,
              opacity: aboutVis ? 1 : 0,
              transition: "opacity 0.8s ease 0.2s",
            }}>
              We are a group of students from TUP Taguig who believe that the best software is built by the people who use it every day.
            </p>
          </div>

          {/* Team grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "3rem" }}>
            {team.map((member, i) => (
              <TeamCard key={member.name} member={member} delay={i * 120} visible={aboutVis} />
            ))}
          </div>

          {/* Horizontal rule */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "5rem 0" }} />

          {/* Values */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4rem" }}>
            {[
              ["2026", "Founded in Philippines", "A capstone student project from TUP Taguig."],
              ["WEBT-TRaC", "Regulatory Compliance", "Ensures that tricycle drivers and operators comply with local regulations and association policies."],
              ["Community Safety", "Our commitment", "Promotes road safety awareness, accountability, and responsible tricycle services."],
            ].map(([kicker, title, desc], i) => (
              <div key={title} style={{
                opacity: aboutVis ? 1 : 0,
                transition: `opacity 0.8s ease ${300 + i * 120}ms`,
              }}>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--clay)", marginBottom: 12 }}>{kicker}</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", fontWeight: 300, color: "var(--warm-white)", marginBottom: 10 }}>{title}</p>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.8rem", lineHeight: 1.8, color: "var(--ash)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" ref={contactRef} style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "80vh",
      }}>
        {/* Left info */}
        <div style={{
          background: "var(--clay)",
          padding: "7rem 5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* BG kanji */}
          <div style={{
            position: "absolute", bottom: "-4rem", right: "-2rem",
            fontFamily: "var(--serif)",
            fontSize: "20rem",
            color: "rgba(255,255,255,0.06)",
            lineHeight: 1,
            pointerEvents: "none",
            userSelect: "none",
          }}>和</div>

          <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <span style={{ width: 30, height: 1, background: "rgba(255,255,255,0.5)", display: "block" }} />
            Contact Us
          </p>

          <h2 style={{
            fontFamily: "var(--serif)",
            fontSize: "clamp(2rem, 3.5vw, 3rem)",
            fontWeight: 300,
            color: "var(--warm-white)",
            lineHeight: 1.2,
            marginBottom: "2rem",
            opacity: contactVis ? 1 : 0,
            transform: contactVis ? "none" : "translateY(20px)",
            transition: "opacity 0.8s ease, transform 0.8s ease",
          }}>
            Let's start a<br />
            <em>quiet conversation</em>
          </h2>

          <p style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", lineHeight: 1.9, color: "rgba(255,255,255,0.75)", maxWidth: 360, marginBottom: "3rem" }}>
            Whether you're a potential partner, a press inquiry, or simply someone who wants to share feedback — we read every message carefully and respond thoughtfully.
          </p>

          {/* Contact details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {[
              ["Email", "hello@webt-trac.org"],
              ["Press", "press@webt-trac.org"],
              ["Location", "Taguig · Philippines"],
            ].map(([label, value]) => (
              <div key={label} style={{
                opacity: contactVis ? 1 : 0,
                transition: "opacity 0.8s ease 0.3s",
              }}>
                <p style={{ fontFamily: "var(--sans)", fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", fontWeight: 300, color: "var(--warm-white)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div style={{
          background: "var(--parchment)",
          padding: "7rem 5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: contactVis ? 1 : 0,
          transform: contactVis ? "none" : "translateX(24px)",
          transition: "opacity 0.9s ease 0.2s, transform 0.9s ease 0.2s",
        }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", fontWeight: 300, color: "var(--ink)", marginBottom: "2.5rem", letterSpacing: "0.02em" }}>
            Send us a message
          </p>
          <ContactForm />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: "var(--ink)",
        padding: "2.5rem 4rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <p style={{ fontFamily: "var(--serif)", fontSize: "0.95rem", color: "var(--fog)", letterSpacing: "0.2em" }}>
          WEBT-TRaC
        </p>
        <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--ash)", textTransform: "uppercase" }}>
          Crafted for Western Bicutan · Community-focused
        </p>
        <p style={{ fontFamily: "var(--sans)", fontSize: "0.6rem", color: "var(--ash)", letterSpacing: "0.1em" }}>
          © 2026 WEBT-TRaC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
