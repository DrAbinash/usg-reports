/**
 * A small in-process attempt counter — the whole of this clinic's brute-force
 * defence, and deliberately not more.
 *
 * The studio is one doctor, one workstation, behind Caddy, with a six-digit PIN
 * (a 10^6 keyspace) and a public report-verification endpoint that answers yes or
 * no to a signature. Until now the only thing between a guesser and those was a
 * 400 ms sleep. Counting failures per client is a few lines, costs no
 * dependency, and stops the casual attack dead; a persistent one is Caddy's job
 * and the deploy notes say which line to add there.
 *
 * State lives in this process. That is correct for one long-lived Node server
 * and self-evidently temporary for a second instance — a restart clears it, so a
 * locked-out doctor retries in a minute, not forever.
 */

type Bucket = { fails: number; firstAt: number };

const buckets = new Map<string, Bucket>();

export type Rule = { max: number; windowMs: number };

/** PIN guessing is the threat worth naming: eight wrong PINs per ten minutes. */
export const PIN_RULE: Rule = { max: 8, windowMs: 10 * 60 * 1000 };
/** Verification is used by patients scanning a sheet; generous but not open. */
export const VERIFY_RULE: Rule = { max: 30, windowMs: 10 * 60 * 1000 };

/**
 * The client as best it can be known behind a proxy. X-Forwarded-For is spoofable
 * by a client that controls nothing else about the socket, but the alternative —
 * a global counter — locks the whole clinic out because one person mistyped.
 */
export function clientKey(req: Request, salt: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return `${salt}:${fwd || real || "unknown"}`;
}

/** Is this client still allowed to try? */
export function gated(key: string, rule: Rule, nowMs = Date.now()): { blocked: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b) return { blocked: false, retryAfterMs: 0 };
  if (nowMs - b.firstAt > rule.windowMs) {
    buckets.delete(key);
    return { blocked: false, retryAfterMs: 0 };
  }
  if (b.fails < rule.max) return { blocked: false, retryAfterMs: 0 };
  return { blocked: true, retryAfterMs: rule.windowMs - (nowMs - b.firstAt) };
}

/** Record a failure, or clear the count on a success. */
export function noteAttempt(key: string, ok: boolean, nowMs = Date.now()): void {
  if (buckets.size > 5_000) {
    // Never let a counter become the outage it is preventing.
    for (const [k, v] of buckets) if (nowMs - v.firstAt > 60 * 60 * 1000) buckets.delete(k);
  }
  if (ok) {
    buckets.delete(key);
    return;
  }
  const b = buckets.get(key);
  if (!b) buckets.set(key, { fails: 1, firstAt: nowMs });
  else if (nowMs - b.firstAt > 60 * 60 * 1000) buckets.set(key, { fails: 1, firstAt: nowMs });
  else b.fails += 1;
}

/** Test seams and a way for the lock screen to reset itself after a PIN change. */
export function clearAttempts(key?: string): void {
  if (key) buckets.delete(key);
  else buckets.clear();
}

export function retrySeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}
