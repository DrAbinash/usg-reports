"use client";
/** First-run setup + PIN lock screens — calm, keypad-first. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope, Delete, ShieldCheck, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

function Keypad({ onDigit, onBack }: { onDigit: (d: string) => void; onBack: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid w-64 grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onDigit(k)}
          className="h-12 rounded-lg border border-border bg-card text-lg font-semibold text-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-accent active:scale-95"
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onBack}
        className="flex h-12 items-center justify-center rounded-lg border border-border bg-card text-faint shadow-sm transition-all hover:border-primary/50 hover:text-foreground active:scale-95"
        aria-label="Delete last digit"
      >
        <Delete className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onDigit("0")}
        className="h-12 rounded-lg border border-border bg-card text-lg font-semibold text-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-accent active:scale-95"
      >
        0
      </button>
      <div />
    </div>
  );
}

function PinDots({ length, error }: { length: number; error?: boolean }) {
  return (
    <div className="flex gap-2.5" aria-label={`${length} of 6 digits entered`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-3 w-3 rounded-full border transition-all",
            i < length
              ? error
                ? "border-bad bg-bad"
                : "border-primary bg-primary"
              : "border-input bg-card",
          )}
        />
      ))}
    </div>
  );
}

function StudioMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Stethoscope className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-bold tracking-tight text-foreground">CARE Reporting Studio</div>
        <div className="text-[11px] text-faint">Radiology · Deoghar</div>
      </div>
    </div>
  );
}

export function SetupScreen({ onDone }: { onDone: () => void }) {
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1f6fa] to-[#fafcfd] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[0_8px_40px_-12px_rgba(46,109,164,0.18)]">
        <StudioMark />
        <div className="mt-6 flex items-center gap-2 text-primary">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-sm font-semibold">Welcome — set your PIN</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          This studio belongs to one radiologist. Your 6-digit PIN unlocks it on this device.
        </p>
        <div className="mt-6 flex flex-col items-center gap-5">
          <PinDots length={(stage === "first" ? pin : confirm).length} error={!!error} />
          <Keypad onDigit={push} onBack={back} />
          {error ? <p className="text-[12px] font-medium text-destructive">{error}</p> : null}
          {busy ? <p className="text-[12px] text-muted-foreground">Saving…</p> : null}
          <p className="text-[11px] text-faint">
            {stage === "first" ? "Step 1 of 2 — choose a PIN" : "Step 2 of 2 — confirm it"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1f6fa] to-[#fafcfd] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[0_8px_40px_-12px_rgba(46,109,164,0.18)]">
        <StudioMark />
        <div className="mt-6 flex items-center gap-2 text-primary">
          <HeartPulse className="h-4 w-4" />
          <span className="text-sm font-semibold">Studio locked</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          Enter your PIN to continue reporting.
        </p>
        <div className="mt-6 flex flex-col items-center gap-5">
          <PinDots length={pin.length} error={!!error} />
          <Keypad onDigit={push} onBack={back} />
          {error ? <p className="text-[12px] font-medium text-destructive">{error}</p> : null}
          {busy ? <p className="text-[12px] text-muted-foreground">Unlocking…</p> : null}
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Checkbox checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
            Trust this device for 30 days
          </label>
          <p className="rounded-md bg-accent px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-border">
            Demo PIN: <span className="font-mono font-semibold text-primary">123456</span> — change in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
