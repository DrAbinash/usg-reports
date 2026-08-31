"use client";
/**
 * First-run setup + PIN lock screens — colourful, personal, keypad-first.
 * Six animated gradient themes + optional user-uploaded background photo
 * (Settings → Appearance). Glassmorphism card over an aurora field.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope, Delete, ShieldCheck, HeartPulse, Waves, Sun, Globe, Flower2, Leaf, Gem, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Colour themes ───────────────────────────────────────────────────────────
export type LoginThemeName = "aurora" | "sunset" | "ocean" | "rose" | "emerald" | "royal";

type Theme = {
  label: string;
  icon: typeof Waves;
  /** three aurora blob colours */
  blobs: [string, string, string];
  /** main accent gradient (buttons, logo, dots) */
  accent: string;
  /** soft tint of the accent for hovers */
  soft: string;
  /** overlay on top of a user photo (keeps the card readable) */
  photoOverlay: string;
};

export const LOGIN_THEMES: Record<LoginThemeName, Theme> = {
  aurora: {
    label: "Aurora", icon: Waves,
    blobs: ["#8b5cf6", "#ec4899", "#06b6d4"],
    accent: "linear-gradient(135deg,#7c3aed 0%,#d946ef 55%,#06b6d4 130%)",
    soft: "#8b5cf6",
    photoOverlay: "linear-gradient(160deg,rgba(76,29,149,0.55),rgba(88,28,135,0.75))",
  },
  sunset: {
    label: "Sunset", icon: Sun,
    blobs: ["#f97316", "#f43f5e", "#fbbf24"],
    accent: "linear-gradient(135deg,#ea580c 0%,#f43f5e 60%,#fbbf24 130%)",
    soft: "#f97316",
    photoOverlay: "linear-gradient(160deg,rgba(124,45,18,0.5),rgba(159,18,57,0.72))",
  },
  ocean: {
    label: "Ocean", icon: Globe,
    blobs: ["#2563eb", "#06b6d4", "#14b8a6"],
    accent: "linear-gradient(135deg,#1d4ed8 0%,#0891b2 55%,#14b8a6 130%)",
    soft: "#2563eb",
    photoOverlay: "linear-gradient(160deg,rgba(30,58,138,0.5),rgba(19,78,74,0.72))",
  },
  rose: {
    label: "Rose", icon: Flower2,
    blobs: ["#ec4899", "#f43f5e", "#a855f7"],
    accent: "linear-gradient(135deg,#db2777 0%,#f43f5e 55%,#a855f7 130%)",
    soft: "#ec4899",
    photoOverlay: "linear-gradient(160deg,rgba(131,24,67,0.5),rgba(88,28,135,0.72))",
  },
  emerald: {
    label: "Emerald", icon: Leaf,
    blobs: ["#10b981", "#14b8a6", "#84cc16"],
    accent: "linear-gradient(135deg,#059669 0%,#0d9488 55%,#65a30d 130%)",
    soft: "#10b981",
    photoOverlay: "linear-gradient(160deg,rgba(6,78,59,0.5),rgba(21,94,89,0.72))",
  },
  royal: {
    label: "Royal", icon: Gem,
    blobs: ["#4f46e5", "#7c3aed", "#3b82f6"],
    accent: "linear-gradient(135deg,#4338ca 0%,#7c3aed 55%,#2563eb 130%)",
    soft: "#4f46e5",
    photoOverlay: "linear-gradient(160deg,rgba(49,46,129,0.5),rgba(91,33,182,0.72))",
  },
};

const resolveTheme = (name?: string | null): Theme =>
  LOGIN_THEMES[(name ?? "aurora") as LoginThemeName] ?? LOGIN_THEMES.aurora;

type Branding = { theme?: string | null; bgUrl?: string | null; appTitle?: string | null; hospitalName?: string | null };

/** Fetch pre-auth branding (theme + uploaded background photo). */
function useLoginBranding(): Branding {
  const [b, setB] = useState<Branding>({});
  useEffect(() => {
    fetch("/api/auth/state")
      .then((r) => r.json())
      .then((d) => setB(d.loginBranding ?? {}))
      .catch(() => {});
  }, []);
  return b;
}

// ── The colourful animated backdrop ────────────────────────────────────────
function LoginBackdrop({ theme, bgUrl }: { theme: Theme; bgUrl?: string | null }) {
  const [a, b, c] = theme.blobs;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0 bg-[#f6f2ff] dark:bg-[#0d0a1f]" />
      {bgUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
          <div className="absolute inset-0" style={{ background: theme.photoOverlay }} />
        </>
      ) : null}
      {/* aurora blobs */}
      <div
        className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-50 blur-[110px] login-blob login-blob-a"
        style={{ background: a }}
      />
      <div
        className="absolute -bottom-48 -right-32 h-[620px] w-[620px] rounded-full opacity-45 blur-[120px] login-blob login-blob-b"
        style={{ background: b }}
      />
      <div
        className="absolute left-1/3 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full opacity-35 blur-[100px] login-blob login-blob-c"
        style={{ background: c }}
      />
      {/* fine grid for texture */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          color: "#312e81",
        }}
      />
      {!bgUrl ? (
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/0 to-white/40 dark:to-black/30" />
      ) : null}
    </div>
  );
}

const KEYFRAME_STYLE = `
@keyframes login-float-a { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(70px,50px) scale(1.12)} }
@keyframes login-float-b { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-80px,-40px) scale(1.08)} }
@keyframes login-float-c { 0%,100%{transform:translate(0,-50%) scale(1)} 50%{transform:translate(40px,-56%) scale(1.1)} }
.login-blob-a { animation: login-float-a 16s ease-in-out infinite; }
.login-blob-b { animation: login-float-b 19s ease-in-out infinite; }
.login-blob-c { animation: login-float-c 13s ease-in-out infinite; }
@keyframes login-pop { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }
.login-card-in { animation: login-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
`;

// ── Shared pieces ──────────────────────────────────────────────────────────
function Keypad({ onDigit, onBack, accent }: { onDigit: (d: string) => void; onBack: () => void; accent: string }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid w-64 grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onDigit(k)}
          className="h-12 rounded-xl border border-white/60 bg-white/70 text-lg font-bold text-slate-800 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-slate-100"
          style={{ ["--accent" as string]: accent }}
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onBack}
        className="flex h-12 items-center justify-center rounded-xl border border-white/60 bg-white/70 text-slate-500 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-slate-800 active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
        aria-label="Delete last digit"
      >
        <Delete className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onDigit("0")}
        className="h-12 rounded-xl border border-white/60 bg-white/70 text-lg font-bold text-slate-800 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-slate-100"
      >
        0
      </button>
      <div />
    </div>
  );
}

function PinDots({ length, error, accent }: { length: number; error?: boolean; accent: string }) {
  return (
    <div className="flex gap-2.5" aria-label={`${length} of 6 digits entered`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={cn("h-3.5 w-3.5 rounded-full border-2 transition-all duration-200", i < length ? "scale-110" : "border-white/80 bg-white/30 dark:border-white/25")}
          style={i < length ? { background: error ? "#e11d48" : accent, borderColor: "transparent", boxShadow: "0 2px 10px rgba(0,0,0,0.18)" } : undefined}
        />
      ))}
    </div>
  );
}

function StudioMark({ accent, title, subtitle }: { accent: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: accent }}
      >
        <Stethoscope className="h-6 w-6" />
      </div>
      <div>
        <div className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</div>
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300">{subtitle}</div>
      </div>
    </div>
  );
}

function LockCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[0_24px_70px_-18px_rgba(49,46,129,0.35)] backdrop-blur-xl login-card-in dark:border-white/15 dark:bg-slate-900/60">
      {children}
    </div>
  );
}

// ── Setup (first run) ──────────────────────────────────────────────────────
export function SetupScreen({ onDone }: { onDone: () => void }) {
  const branding = useLoginBranding();
  const theme = resolveTheme(branding.theme);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"first" | "confirm">("first");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const push = (d: string) => {
    setError("");
    const cur = stage === "first" ? pin : confirm;
    if (cur.length >= 6) return;
    const next = cur + d;
    if (stage === "first") setPin(next);
    else setConfirm(next);
    if (next.length === 6) {
      if (stage === "first") {
        setTimeout(() => setStage("confirm"), 150);
      } else {
        if (next !== pin) {
          setError("PINs do not match — start again");
          setPin("");
          setConfirm("");
          setStage("first");
          return;
        }
        setBusy(true);
        fetch("/api/auth/setup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pin: next }),
        })
          .then((r) => r.json())
          .then((r) => {
            if (r.error) setError(r.error);
            else onDone();
          })
          .catch(() => setError("Could not save PIN"))
          .finally(() => setBusy(false));
      }
    }
  };

  const back = () => {
    const cur = stage === "first" ? pin : confirm;
    const next = cur.slice(0, -1);
    if (stage === "first") setPin(next);
    else setConfirm(next);
    setError("");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <style>{KEYFRAME_STYLE}</style>
      <LoginBackdrop theme={theme} bgUrl={branding.bgUrl} />
      <LockCard>
        <StudioMark accent={theme.accent} title={branding.appTitle || "CARE USG Studio"} subtitle={branding.hospitalName || "Sonography · CARE Diagnostics"} />
        <div className="mt-6 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: theme.soft }} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Welcome — set your PIN</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-300">
          This studio belongs to one sonologist. Your 6-digit PIN unlocks it on this device.
        </p>
        <div className="mt-6 flex flex-col items-center gap-5">
          <PinDots length={(stage === "first" ? pin : confirm).length} error={!!error} accent={theme.accent} />
          <Keypad onDigit={push} onBack={back} accent={theme.accent} />
          {error ? <p className="text-[12px] font-semibold text-rose-600">{error}</p> : null}
          {busy ? <p className="text-[12px] text-slate-500 dark:text-slate-300">Saving…</p> : null}
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400">
            {stage === "first" ? "Step 1 of 2 — choose a PIN" : "Step 2 of 2 — confirm it"}
          </p>
        </div>
      </LockCard>
    </div>
  );
}

// ── Lock (every day) ───────────────────────────────────────────────────────
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const branding = useLoginBranding();
  const theme = resolveTheme(branding.theme);
  const [pin, setPin] = useState("");
  const [trust, setTrust] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const push = (d: string) => {
    setError("");
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) {
      setBusy(true);
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: next, trust }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (r.error) {
            setError(r.error);
            setPin("");
          } else onUnlock();
        })
        .catch(() => {
          setError("Could not reach the studio");
          setPin("");
        })
        .finally(() => setBusy(false));
    }
  };

  const back = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <style>{KEYFRAME_STYLE}</style>
      <LoginBackdrop theme={theme} bgUrl={branding.bgUrl} />
      <LockCard>
        <StudioMark accent={theme.accent} title={branding.appTitle || "CARE USG Studio"} subtitle={branding.hospitalName || "Sonography · CARE Diagnostics"} />

        <div className="mt-6 flex items-center gap-2">
          <HeartPulse className="h-4 w-4" style={{ color: theme.soft }} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Studio locked</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-300">
          Enter your PIN to continue reporting.
        </p>

        <div className="mt-6 flex flex-col items-center gap-5">
          <PinDots length={pin.length} error={!!error} accent={theme.accent} />
          <Keypad onDigit={push} onBack={back} accent={theme.accent} />
          {error ? <p className="text-[12px] font-semibold text-rose-600">{error}</p> : null}
          {busy ? <p className="text-[12px] text-slate-500 dark:text-slate-300">Unlocking…</p> : null}
          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600 dark:text-slate-300">
            <Checkbox checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
            Trust this device for 30 days
          </label>
          <p className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-white/70 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15">
            <ImageIcon className="h-3 w-3" />
            Personalise this screen — Settings → Appearance
          </p>
          <p className="rounded-full bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-white/70 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15">
            Demo PIN: <span className="font-mono font-bold" style={{ color: theme.soft }}>123456</span> — change in Settings
          </p>
        </div>
      </LockCard>
    </div>
  );
}
