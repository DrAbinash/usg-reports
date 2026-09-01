"use client";
/**
 * v6.1 "Sonologist's Day" — the birthday card (screen-only, never printed).
 *
 * Once a year, when the local date matches Settings → usgDoctorBirthday,
 * the studio opens with this full-screen card: confetti, an ultrasound-
 * styled heart under a live scan sweep, and the sonologist's REAL numbers
 * from the register — reports signed, patients cared for, busiest month.
 *
 * Dismissal is remembered per calendar year (localStorage), and a small
 * cake icon stays in the header for the rest of the day so the card can
 * be reopened with one click. No new dependencies — pure CSS animation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Cake, Sparkles } from "lucide-react";
import { birthdayLabel, dismissalKey, greetingName, isBirthdayToday } from "@/lib/usg/birthday";

export type BirthdayFlag = { today: boolean; name: string; birthday: string } | null;

/** AppShell hook: resolves the masked settings once, decides if today is
 *  the day. Returns null while loading (nothing renders — no layout shift). */
export function useBirthdayFlag(): BirthdayFlag {
  const [flag, setFlag] = useState<BirthdayFlag>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.settings) return;
        const birthday = String(d.settings.usgDoctorBirthday ?? "");
        setFlag({
          today: isBirthdayToday(birthday),
          name: String(d.settings.usgDoctorName ?? ""),
          birthday,
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return flag;
}

type Stat = { value: string; label: string };

/** Real impact numbers for the card — from the practice analytics API. */
function useBirthdayStats(open: boolean): Stat[] | null {
  const [stats, setStats] = useState<Stat[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/usg/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.analytics) return;
        const a = d.analytics as {
          totalFinalized?: number;
          patients?: number;
          perMonth?: { label: string; count: number }[];
        };
        const out: Stat[] = [
          { value: String(a.totalFinalized ?? 0), label: "reports signed" },
          { value: String(a.patients ?? 0), label: "patients in the registry" },
        ];
        const busiest = (a.perMonth ?? []).reduce<{ label: string; count: number } | null>(
          (best, m) => (m.count > 0 && (!best || m.count > best.count) ? m : best), null,
        );
        if (busiest) out.push({ value: busiest.label, label: `busiest month — ${busiest.count} scans` });
        setStats(out);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);
  return stats;
}

const CONFETTI_COLORS = ["#f43f5e", "#d946ef", "#8b5cf6", "#fbbf24", "#38bdf8", "#fb7185"];

/** Fixed, pointer-transparent confetti field. Randomised once per open on
 *  the client only — the overlay only ever renders after a fetch resolves,
 *  so there is no SSR markup to mismatch. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.6,
        duration: 3.6 + Math.random() * 3.2,
        w: 6 + Math.random() * 4,
        h: 8 + Math.random() * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() < 0.3,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="bday-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/** The ultrasound heart: a beating heart with a probe sweep gliding across
 *  it and a fetal-heartbeat trace running underneath — her daily view,
 *  drawn back at her. Pure inline SVG + CSS classes from globals.css. */
function UltrasoundHeart() {
  return (
    <div aria-hidden className="relative mx-auto w-fit">
      <span className="relative inline-block">
        <div className="bday-heart rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-500 p-5 shadow-[0_0_45px_-8px_rgba(217,70,239,.65)]">
          <svg viewBox="0 0 24 24" className="h-11 w-11 text-white" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        {/* Probe sweep gliding across the heart */}
        <span className="bday-sweep absolute left-1/2 top-1/2 h-16 w-1.5 rounded-full bg-white/70 blur-[1px]" />
      </span>
      {/* Fetal heartbeat trace */}
      <svg viewBox="0 0 140 40" className="mt-3 h-8 w-44 text-rose-400">
        <path
          d="M0 22 L26 22 L34 10 L42 34 L50 22 L74 22 L82 16 L88 22 L114 22 L122 12 L128 22 L140 22"
          fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
          className="opacity-30"
        />
        <path
          d="M0 22 L26 22 L34 10 L42 34 L50 22 L74 22 L82 16 L88 22 L114 22 L122 12 L128 22 L140 22"
          fill="none" stroke="url(#bdayEcg)" strokeWidth="2.2" strokeLinecap="round"
          pathLength={1} className="bday-ecg"
        />
        <defs>
          <linearGradient id="bdayEcg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="60%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function UsgBirthdayGreeting({
  open, onClose, name, birthday,
}: { open: boolean; onClose: () => void; name: string; birthday: string }) {
  const stats = useBirthdayStats(open);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Esc closes the card (same muscle memory as every dialog in the studio).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    btnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasWork = !!stats && Number(stats[0]?.value ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Birthday greeting">
      <Confetti />
      <div className="bday-card-in relative w-full max-w-md overflow-hidden rounded-3xl border border-fuchsia-200/70 bg-card shadow-2xl">
        {/* Identity gradient edge, matching the studio header */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500" />
        <div className="px-8 pb-7 pt-9 text-center">
          <UltrasoundHeart />

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fuchsia-50 px-3 py-1 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
            <Sparkles className="h-3 w-3" />
            {birthdayLabel(birthday) || "Today"} · Sonologist&apos;s Day
          </div>

          <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Happy Birthday, {greetingName(name)}
          </h1>

          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            Before the first probe warms up today — a moment for the person
            behind every report. Every scan was someone waiting for an answer,
            and they left with one. May the year ahead be as kind to you as
            you are to them.
          </p>

          {/* Her real numbers — only counts, same privacy rule as Insights */}
          {stats ? (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-panel px-2 py-2.5">
                  <div className="bg-gradient-to-br from-rose-600 to-fuchsia-600 bg-clip-text text-[18px] font-extrabold leading-none text-transparent">{s.value}</div>
                  <div className="mt-1 text-[10px] font-medium leading-tight text-faint">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 h-[58px] animate-pulse rounded-xl border border-border bg-panel/60" />
          )}
          {!hasWork && stats ? (
            <p className="mt-3 text-[11.5px] italic text-faint">
              The register is still young — this year it fills with your hands.
            </p>
          ) : null}

          <button
            ref={btnRef}
            onClick={onClose}
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 text-[13.5px] font-semibold text-white shadow-md transition-transform hover:scale-[1.01] active:scale-[.99]"
          >
            <Cake className="h-4 w-4" />
            Thank you — back to the probe
          </button>
          <p className="mt-3 text-[11px] text-faint">
            With love, from your CARE USG Studio 💜
          </p>
        </div>
      </div>
    </div>
  );
}

/** Header companion: the little cake that glows all day on the birthday. */
export function BirthdayHeaderButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Happy Birthday! — open the card again"
      aria-label="Happy Birthday — open the greeting card again"
      className="bday-cake flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-50 text-fuchsia-600 ring-1 ring-fuchsia-200 transition-colors hover:bg-fuchsia-100"
    >
      <Cake className="h-4 w-4" />
    </button>
  );
}

/** Shared dismissal memory — one "seen" per calendar year, self-expiring. */
export function birthdayDismissed(year: number): boolean {
  try {
    return !!localStorage.getItem(dismissalKey(year));
  } catch {
    return false;
  }
}
export function rememberBirthdayDismissed(year: number): void {
  try {
    localStorage.setItem(dismissalKey(year), "1");
  } catch {
    // private-mode Safari — the card may show again next unlock; harmless
  }
}
