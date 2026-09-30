/**
 * OHIF resolver (server-only) — the single configuration source for the viewer.
 *
 * Why it lives on the server: reachability has to be decided by something the
 * browser cannot be — a fetch from an https page to the plain-http LAN viewer
 * is blocked as mixed active content, and a cross-origin probe of the
 * Tailscale host is blocked by CORS. Either way the browser would report
 * "unreachable" for a perfectly healthy viewer. So the server probes, and only
 * safe status/configuration is returned to the client.
 *
 * AUTO is a real reachability walk, not a scheme guess:
 *   LAN → configured canonical/custom → Tailscale,
 * skipping anything not configured and falling over on the first failure.
 *
 * The browser that asked may pass its own scheme (pageProtocol). AUTO then
 * keeps walking past a candidate that is reachable but which that page cannot
 * frame — an https page and a plain-http LAN viewer — so the HTTPS Tailscale
 * endpoint is still found. Reachability is still measured only here, on the
 * server; the scheme is not a measurement, just a rule the browser already
 * enforces.
 *
 * Nothing in here hard-codes an endpoint; the values come from Settings
 * (ohifMode / ohifLanUrl / ohifTailscaleUrl / ohifCustomUrl) with env and
 * LAN defaults applied by src/lib/settings.ts.
 */
import { getSettings } from "@/lib/settings";
import { isEmbedSafe } from "@/lib/usg/ohifLaunch";
import type {
  OhifCandidateKey,
  OhifEndpointInfo,
  OhifRoute,
  OhifStatus,
} from "@/lib/usg/ohifLaunch";

const LABELS: Record<OhifCandidateKey, string> = {
  lan: "LAN viewer",
  tailscale: "Tailscale viewer",
  custom: "Custom viewer",
};

/** AUTO preference: on-site viewer first (works with no internet), then the
 * clinic's canonical endpoint, then the Tailscale host. */
const AUTO_ORDER: readonly OhifCandidateKey[] = ["lan", "custom", "tailscale"] as const;

function numEnv(name: string, def: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

/** AUTO stays short — the walk is sequential, so a dead LAN must not stall the
 * workspace while the doctor is mid-report. */
const autoHeadMs = () => numEnv("OHIF_PROBE_TIMEOUT_MS", 1_500);
const autoGetMs = () => numEnv("OHIF_PROBE_GET_TIMEOUT_MS", 2_500);
/** "Test OHIF" is an explicit diagnostic, so it can afford the longer waits. */
const testHeadMs = () => numEnv("OHIF_TEST_TIMEOUT_MS", 8_000);
const testGetMs = () => numEnv("OHIF_TEST_GET_TIMEOUT_MS", 6_000);

/** A confirmed route is trusted briefly; a failure is retried sooner so the
 * viewer comes back on its own after a blip. */
const okTtlMs = () => numEnv("OHIF_PROBE_CACHE_MS", 60_000);
const failTtlMs = () => numEnv("OHIF_PROBE_FAIL_CACHE_MS", 15_000);

export type ProbeOutcome = {
  reachable: boolean;
  status?: number;
  error?: string;
  latencyMs: number;
  /** True when served from the cache rather than by contacting the viewer. */
  cached: boolean;
};

type CacheEntry = { at: number; outcome: Omit<ProbeOutcome, "cached"> };

// Keyed by endpoint URL: editing an endpoint in Settings changes the key, so
// the old entry is simply never looked up again — config edits invalidate
// themselves.
const probeCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Omit<ProbeOutcome, "cached">>>();

export function invalidateOhifProbes(): void {
  probeCache.clear();
  inFlight.clear();
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET", ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { method, signal: controller.signal, cache: "no-store", redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function describeNetworkFailure(e: unknown, label: string, ms: number): string {
  if (e instanceof Error && e.name === "AbortError") return `${label} timed out (${(ms / 1000).toFixed(1)}s)`;
  if (e instanceof TypeError && /invalid url|failed to parse/i.test(e.message)) {
    return `${label} unreachable (invalid URL — must start with http:// or https://)`;
  }
  return `${label} unreachable`;
}

/**
 * Probe one absolute http(s) URL.
 *
 * HEAD first (cheap, no body). OHIF and the proxies in front of it commonly
 * reject HEAD with 403/405/501 — that is not an outage, so retry with GET.
 * Any 2xx from either verb means reachable. When the server *did* answer, say
 * which status came back; only a genuine network error is called unreachable.
 */
export async function probeViewer(
  rawUrl: string,
  label: string,
  opts: { headMs?: number; getMs?: number } = {},
): Promise<ProbeOutcome> {
  const url = rawUrl.trim();
  if (!url) {
    return { reachable: false, error: `${label} URL not set`, latencyMs: 0, cached: false };
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      reachable: false,
      error: `${label} unreachable (invalid URL — must start with http:// or https://)`,
      latencyMs: 0,
      cached: false,
    };
  }

  const headMs = opts.headMs ?? autoHeadMs();
  const getMs = opts.getMs ?? autoGetMs();
  const started = Date.now();
  const finish = (
    o: Omit<ProbeOutcome, "cached" | "latencyMs">,
    cached: boolean,
  ): ProbeOutcome => ({
    ...o,
    latencyMs: cached ? 0 : Date.now() - started,
    cached,
  });

  let head: Response;
  try {
    head = await fetchWithTimeout(url, "HEAD", headMs);
  } catch (e) {
    return finish({ reachable: false, error: describeNetworkFailure(e, label, headMs) }, false);
  }
  if (head.ok) return finish({ reachable: true, status: head.status }, false);

  if (head.status === 403 || head.status === 405 || head.status === 501) {
    let get: Response;
    try {
      get = await fetchWithTimeout(url, "GET", getMs);
    } catch (e) {
      return finish({ reachable: false, error: describeNetworkFailure(e, label, getMs) }, false);
    }
    if (get.ok) {
      return finish({ reachable: true, status: get.status, error: undefined }, false);
    }
    return finish({ reachable: false, status: get.status, error: `${label} responded ${get.status}` }, false);
  }

  return finish({ reachable: false, status: head.status, error: `${label} responded ${head.status}` }, false);
}

/** Cached + deduped probe, so a busy workspace never fans out repeated probes. */
async function probeCached(url: string, label: string, force: boolean, generous: boolean): Promise<ProbeOutcome> {
  const ttl = (): number => {
    const hit = probeCache.get(url);
    return hit && hit.outcome.reachable ? okTtlMs() : failTtlMs();
  };

  if (!force) {
    const hit = probeCache.get(url);
    if (hit && Date.now() - hit.at < ttl()) {
      return { ...hit.outcome, cached: true };
    }
  }

  const pending = inFlight.get(url);
  if (pending) {
    const outcome = await pending;
    return { ...outcome, cached: false };
  }

  const run = probeViewer(
    url,
    label,
    generous ? { headMs: testHeadMs(), getMs: testGetMs() } : { headMs: autoHeadMs(), getMs: autoGetMs() },
  ).then((outcome) => {
    const { cached: _cached, ...stored } = outcome;
    probeCache.set(url, { at: Date.now(), outcome: stored });
    inFlight.delete(url);
    return stored;
  });

  inFlight.set(url, run);
  const outcome = await run;
  return { ...outcome, cached: false };
}

function describeEndpoint(key: OhifCandidateKey, url: string): OhifEndpointInfo {
  const sameOrigin = url.startsWith("/");
  return {
    key,
    label: LABELS[key],
    // An empty URL is genuinely unconfigured — reporting it as configured would
    // show a phantom endpoint in Settings and let a manual route "select" a
    // viewer that was never entered.
    configured: !!url,
    url,
    sameOrigin,
    secure: /^https:\/\//i.test(url),
    // null until probed — a same-origin path is verified by the browser, since
    // the server cannot fetch its own front proxy.
    reachable: null,
    probeBy: sameOrigin ? "browser" : "server",
  };
}

export type OhifConfigSnapshot = {
  mode: OhifRoute;
  endpoints: { key: OhifCandidateKey; label: string; url: string; configured: boolean }[];
};

/** The configured endpoints only — no probing. Used by Settings to render. */
export async function getOhifConfig(): Promise<OhifConfigSnapshot> {
  const s = await getSettings();
  const byKey: Record<OhifCandidateKey, string> = {
    lan: s.ohifLanUrl,
    tailscale: s.ohifTailscaleUrl,
    custom: s.ohifCustomUrl,
  };
  return {
    mode: s.ohifMode,
    endpoints: AUTO_ORDER.map((key) => ({
      key,
      label: LABELS[key],
      url: byKey[key],
      configured: !!byKey[key],
    })),
  };
}

async function probeOne(
  ep: OhifEndpointInfo,
  force: boolean,
  generous: boolean,
): Promise<{ endpoint: OhifEndpointInfo; cached: boolean }> {
  if (!ep.configured) {
    return { endpoint: { ...ep, reachable: null, error: "not configured" }, cached: false };
  }
  if (ep.probeBy === "browser") {
    // Same-origin: leave it for the browser, but treat it as usable for the
    // server-side pick — the studio is being served, so its own proxy is too.
    // The client verifies and corrects the value.
    return { endpoint: { ...ep, reachable: null }, cached: false };
  }
  const outcome = await probeCached(ep.url, ep.label, force, generous);
  const endpoint: OhifEndpointInfo = {
    ...ep,
    reachable: outcome.reachable,
    latencyMs: outcome.latencyMs,
  };
  if (outcome.error) endpoint.error = outcome.error;
  else delete endpoint.error;
  return { endpoint, cached: outcome.cached };
}

/**
 * Resolve the viewer for a route preference.
 *
 * @param routeOverride a manual route (the viewer's L/T/C buttons, or the
 *                      Settings mode) wins over the AUTO walk.
 * @param force         bypass the reachability cache.
 * @param pageProtocol  scheme of the page that asked ("https:" | "http:").
 *                      AUTO normally stops at the first reachable candidate —
 *                      correct for the server, wrong for a browser, because an
 *                      https page cannot frame a plain-http viewer. When this
 *                      is https the walk keeps going past a reachable-but-
 *                      unembeddable endpoint so an HTTPS route (the ts.net
 *                      Tailscale viewer, or a same-origin path) is still found,
 *                      and the skipped one is reported as blocked rather than
 *                      as a success. Left undefined, reachability alone decides
 *                      — the pre-existing server-only contract.
 */
export async function resolveOhifStatus(
  opts: { routeOverride?: OhifRoute; force?: boolean; pageProtocol?: string } = {},
): Promise<OhifStatus> {
  const cfg = await getOhifConfig();
  const mode = opts.routeOverride ?? cfg.mode;
  const urls: Record<OhifCandidateKey, string> = Object.fromEntries(
    cfg.endpoints.map((e) => [e.key, e.url]),
  ) as Record<OhifCandidateKey, string>;

  const ordered = AUTO_ORDER.map((key) => describeEndpoint(key, urls[key] ?? ""));

  /** A candidate AUTO may settle on. Same-origin paths report reachable:null
   * from the server (only the browser can probe our own proxy) and count as
   * usable unless the browser has already disproved them. */
  const usable = (e: OhifEndpointInfo): boolean =>
    e.reachable === true || (e.probeBy === "browser" && e.reachable !== false);

  const pageIsHttps = opts.pageProtocol === "https:";
  /** First reachable candidate this page cannot frame, if any. */
  let blockedByPage: OhifEndpointInfo | null = null;

  if (mode === "auto") {
    const probed: OhifEndpointInfo[] = [];
    let pickedKey: OhifCandidateKey | null = null;
    let usedCache = false;
    const failures: string[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const ep = ordered[i];
      if (!ep.configured) {
        // A missing candidate is skipped, never counted as a failure.
        probed.push({ ...ep, reachable: null, error: "not configured" });
        continue;
      }
      const { endpoint, cached } = await probeOne(ep, !!opts.force, false);
      probed.push(endpoint);
      if (usable(endpoint)) {
        if (pageIsHttps && !isEmbedSafe(endpoint, "https:")) {
          // Reachable, but framing it here would show a blank iframe. Keep
          // walking — the next candidate may be the HTTPS route that works.
          // Not a failure of the viewer, so it is not counted as one.
          blockedByPage ??= endpoint;
          continue;
        }
        pickedKey = endpoint.key;
        usedCache = cached;
        // Short-circuit: once the LAN viewer answers we never touch the
        // Tailscale host, so in-clinic viewing needs no internet. The
        // remaining candidates are still reported, just left unprobed.
        for (const rest of ordered.slice(i + 1)) {
          probed.push(
            rest.configured
              ? { ...rest, reachable: null, error: "not probed (AUTO already resolved)" }
              : { ...rest, reachable: null, error: "not configured" },
          );
        }
        break;
      }
      failures.push(`${ep.label}: ${endpoint.error ?? "unreachable"}`);
    }

    const chosen = probed.find((e) => e.key === pickedKey);
    let reason: string;
    if (pickedKey) {
      reason = `${LABELS[pickedKey]} reachable`;
    } else if (blockedByPage) {
      reason =
        `${LABELS[blockedByPage.key]} is reachable but cannot be embedded in an https page — it is plain http. ` +
        `Point Settings → Integrations → OHIF Viewer at an HTTPS route (the Tailscale ts.net address, or a same-origin path).`;
      if (failures.length) reason += ` (${failures.join("; ")})`;
    } else if (failures.length) {
      reason = `no configured viewer reachable (${failures.join("; ")})`;
    } else {
      reason = "no viewer endpoint configured (Settings → Integrations → OHIF Viewer)";
    }

    return {
      mode,
      endpoints: probed,
      serverPick: {
        key: pickedKey,
        url: chosen?.url ?? "",
        reason,
      },
      availability: pickedKey ? "available" : blockedByPage ? "blocked" : "unavailable",
      checkedAt: Date.now(),
      cached: usedCache,
    };
  }

  // Manual route — honoured exactly, and its real state reported. A forced
  // endpoint that is down must show as down, never silently swap to another.
  const target = ordered.find((e) => e.key === mode) ?? null;
  const configured = !!target?.configured;
  const manual = target ? await probeOne({ ...target, configured }, !!opts.force, false) : null;
  const reachable = manual?.endpoint.reachable ?? null;
  // A forced http endpoint on an https page is still the doctor's choice, so
  // the pick is unchanged — but "available" would be a lie: the browser frames
  // it as a blank iframe. Report it as blocked and say why. Unconfigured routes
  // are answered ahead of this, so "blocked" can never mean "not configured".
  const manualBlocked = !!manual && pageIsHttps && !isEmbedSafe(manual.endpoint, "https:");

  const endpoints = ordered.map((e) => {
    if (e.key === mode && manual) return manual.endpoint;
    return { ...e, reachable: null, error: e.configured ? "not selected" : "not configured" };
  });

  return {
    mode,
    endpoints,
    serverPick: {
      key: configured ? mode : null,
      url: configured ? target?.url ?? "" : "",
      reason: !configured
        ? `${LABELS[mode]} is not configured (Settings → Integrations → OHIF Viewer)`
        : reachable === false
          ? `${LABELS[mode]} selected manually but unreachable: ${manual?.endpoint.error ?? "no answer"}`
          : manualBlocked
            ? `${LABELS[mode]} selected manually and reachable, but an https page cannot embed a plain http viewer — the browser will show a blank frame`
            : reachable === null
              ? `${LABELS[mode]} selected manually — browser verifies reachability`
              : `${LABELS[mode]} selected manually and reachable`,
    },
    availability: !configured
      ? "unavailable"
      : reachable === false
        ? "unavailable"
        : manualBlocked
          ? "blocked"
          : "available",
    checkedAt: Date.now(),
    cached: manual?.cached ?? false,
  };
}

export type OhifTestResult = {
  ok: boolean;
  /** Overall: is any configured viewer usable? */
  available: boolean;
  mode: OhifRoute;
  lan: { ok: boolean; error?: string; url: string; latencyMs?: number };
  tailscale: { ok: boolean; error?: string; url: string; latencyMs?: number; configured: boolean };
  custom: { ok: boolean; error?: string; url: string; latencyMs?: number; configured: boolean };
  selected: { key: OhifCandidateKey | null; url: string; reason: string };
  message: string;
};

/**
 * "Test OHIF" — probe EVERY configured candidate with diagnostic timeouts,
 * bypassing the cache, and report each one plus where AUTO would land.
 */
export async function testOhif(): Promise<OhifTestResult> {
  const cfg = await getOhifConfig();
  const byKey: Record<OhifCandidateKey, string> = Object.fromEntries(
    cfg.endpoints.map((e) => [e.key, e.url]),
  ) as Record<OhifCandidateKey, string>;

  async function run(key: OhifCandidateKey): Promise<{ ok: boolean; error?: string; url: string; latencyMs?: number; configured: boolean }> {
    const url = byKey[key] ?? "";
    if (!url) return { ok: false, configured: false, url: "", error: "not configured" };
    const ep = describeEndpoint(key, url);
    if (ep.probeBy === "browser") {
      return { ok: true, configured: true, url, error: "same-origin — verified by the browser" };
    }
    const r = await probeCached(url, ep.label, true, true);
    return {
      ok: r.reachable,
      configured: true,
      url,
      latencyMs: r.latencyMs,
      ...(r.error ? { error: r.error } : {}),
    };
  }

  const [lan, tailscale, custom] = await Promise.all([run("lan"), run("tailscale"), run("custom")]);

  // Reuse the AUTO walk (now warm from the probes above) for the selection.
  const status = await resolveOhifStatus({ routeOverride: "auto" });
  const anyAvailable = [lan, tailscale, custom].some((e) => e.ok);

  const parts: string[] = [];
  parts.push(lan.ok ? `LAN reachable${lan.latencyMs != null ? ` (${lan.latencyMs}ms)` : ""}` : `LAN ${lan.configured ? "unreachable" : "not configured"}`);
  parts.push(tailscale.ok ? `Tailscale reachable${tailscale.latencyMs != null ? ` (${tailscale.latencyMs}ms)` : ""}` : `Tailscale ${tailscale.configured ? "unreachable" : "not configured"}`);
  if (custom.configured) parts.push(custom.ok ? `Custom reachable${custom.latencyMs != null ? ` (${custom.latencyMs}ms)` : ""}` : "Custom unreachable");
  parts.push(
    status.serverPick.key
      ? `AUTO → ${LABELS[status.serverPick.key]}`
      : `AUTO → none (${status.serverPick.reason})`,
  );

  return {
    ok: anyAvailable,
    available: anyAvailable,
    mode: cfg.mode,
    lan: { ok: lan.ok, url: lan.url, ...(lan.error ? { error: lan.error } : {}), ...(lan.latencyMs != null ? { latencyMs: lan.latencyMs } : {}) },
    tailscale: { ok: tailscale.ok, configured: tailscale.configured, url: tailscale.url, ...(tailscale.error ? { error: tailscale.error } : {}), ...(tailscale.latencyMs != null ? { latencyMs: tailscale.latencyMs } : {}) },
    custom: { ok: custom.ok, configured: custom.configured, url: custom.url, ...(custom.error ? { error: custom.error } : {}), ...(custom.latencyMs != null ? { latencyMs: custom.latencyMs } : {}) },
    selected: status.serverPick,
    message: parts.join(" · "),
  };
}
