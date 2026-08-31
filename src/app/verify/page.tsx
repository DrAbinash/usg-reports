"use client";
/**
 * Public report verification (v5) — no PIN. Scan the QR on a printed report
 * (it opens this page with ?d=…) or paste the payload text from the sheet:
 * the studio confirms the signature and the register entry.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BadgeCheck, SearchCheck, ShieldX, Stethoscope } from "lucide-react";

type VerifyResult = {
  valid: boolean;
  reason?: string;
  serial?: string;
  patientName?: string;
  study?: string;
  finalizedOn?: string | null;
};

function VerifyInner() {
  const params = useSearchParams();
  const [payload, setPayload] = useState(params.get("d") ?? "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (raw: string) => {
    if (!raw.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/usg/verify?d=${encodeURIComponent(raw.trim())}`);
      setResult((await res.json()) as VerifyResult);
    } catch {
      setResult({ valid: false, reason: "could not reach the studio" });
    } finally {
      setBusy(false);
    }
  };

  // Auto-check when opened from a QR (?d=…).
  useEffect(() => {
    const d = params.get("d");
    if (d) void check(d);
  }, [params, check]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-violet-500 text-white shadow">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-[16px] font-extrabold tracking-tight">CARE USG Studio</h1>
            <p className="text-[11.5px] text-muted-foreground">Report verification — is this sheet from this studio?</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Paste the code from the report…"
            className="h-9 border-border bg-panel text-[12px]"
          />
          <Button onClick={() => check(payload)} disabled={busy || !payload.trim()} className="h-9 bg-rose-600 hover:bg-rose-700">
            <SearchCheck className="mr-1.5 h-4 w-4" /> Verify
          </Button>
        </div>

        {result ? (
          result.valid ? (
            <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-800">
                <BadgeCheck className="h-4 w-4" /> Genuine report — register entry confirmed
              </p>
              <dl className="space-y-1 text-[12px] text-emerald-900/90">
                <div className="flex justify-between gap-3"><dt className="font-semibold">Register no.</dt><dd className="font-bold">{result.serial}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Patient</dt><dd className="font-bold">{result.patientName}</dd></div>
                {result.study ? (
                  <div className="flex justify-between gap-3"><dt className="font-semibold">Study</dt><dd className="text-right font-bold">{result.study}</dd></div>
                ) : null}
                {result.finalizedOn ? (
                  <div className="flex justify-between gap-3"><dt className="font-semibold">Finalized</dt><dd className="font-bold">{new Date(result.finalizedOn).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</dd></div>
                ) : null}
              </dl>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-rose-800">
                <ShieldX className="h-4 w-4" /> Not verified
              </p>
              <p className="mt-1 text-[11.5px] text-rose-700">
                {result.reason === "signature mismatch"
                  ? "The verification code does not match this studio's signature — the sheet may be altered or from another studio."
                  : result.reason === "no such register entry"
                    ? "No finalized report with this register number exists in this studio."
                    : result.reason === "patient does not match the register"
                      ? "The patient name does not match the register entry for this number."
                      : "Could not verify this payload."}
              </p>
            </div>
          )
        ) : (
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Every printed report carries a QR code (bottom-right). Scanning it opens this page with the
            code pre-filled; the studio checks its signature against the sequential register and confirms
            the report is genuine.
          </p>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[12px] text-faint">Opening verification…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
