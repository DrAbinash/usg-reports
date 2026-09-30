/**
 * OHIF launch contract — client-safe, and the ONLY place a viewer URL is built.
 *
 * There are no OHIF endpoints in this file. Every URL comes from the settings
 * the clinic saved (Settings → Integrations → OHIF Viewer) via the server
 * resolver, which also decides reachability. If you are tempted to add a
 * literal here: the resolver already has a field for it.
 *
 * Server side: src/lib/usg/ohifResolver.ts  (probes candidates, caches, returns
 * /api/usg/ohif/status). Browser side: this module fetches that status, caches
 * it briefly, and picks the endpoint this particular page may actually embed.
 */

export type OhifRoute = "auto" | "lan" | "tailscale" | "custom";

/** Manual route buttons, in display order. */
export const OHIF_ROUTE_BUTTONS: readonly OhifRoute[] = ["auto", "lan", "tailscale", "custom"] as const;

export type OhifCandidateKey = "lan" | "tailscale" | "custom";

export type OhifEndpointInfo = {
  key: OhifCandidateKey;
  /** Human label for the Settings card / viewer chrome. */
  label: string;
  configured: boolean;
  /** Absolute http(s) URL, or a same-origin path such as "/ohif". "" when unset. */
  url: string;
  /** A same-origin path — served through our own reverse proxy, so it inherits
   * the page's scheme and can never be blocked as mixed content. */
  sameOrigin: boolean;
  /** https:// endpoint (a LAN http:// viewer is `secure: false`). */
  secure: boolean;
  /** null = unknown (not configured, or only the browser can probe it). */
  reachable: boolean | null;
  error?: string;
  latencyMs?: number;
  /** Who measured reachability. "browser" for same-origin paths: the server
   * cannot fetch a route that only exists on the proxy in front of it. */
  probeBy: "server" | "browser";
};

export type OhifStatus = {
  /** The clinic's saved routing preference. */
  mode: OhifRoute;
  /** Endpoints in AUTO preference order. */
  endpoints: OhifEndpointInfo[];
  /** What the server would choose on reachability alone. */
  serverPick: { key: OhifCandidateKey | null; url: string; reason: string };
  availability: "available" | "unavailable";
  checkedAt: number;
  cached: boolean;
};

/**
 * Preview-column layout — CARE reportFocus / split / viewerFocus, plus
 * letterpad focus (click letterpad → OHIF shrinks; click OHIF → letterpad shrinks).
 */
export type OhifLayoutMode = "report" | "split" | "viewerPlus" | "letterpad";

// ── URL construction ──────────────────────────────────────────────────
// OHIF's own route + query contract. StudyInstanceUIDs is plural and the value
// must stay percent-encoded — the viewer's study lookup depends on both.

export function ohifStudyPath(studyInstanceUid: string): string {
  return `/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
}

/** `${base}/viewer?StudyInstanceUIDs=…` — a same-origin base ("/ohif") stays
 * relative, which is exactly what an iframe src / window.open wants. */
export function buildOhifViewerUrl(baseUrl: string, studyInstanceUid: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return "";
  return `${base}${ohifStudyPath(studyInstanceUid)}`;
}

/** The viewer landing page (no study) — the "open PACS" worklist entry. */
export function buildOhifWorklistUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/viewer`;
}

export function ohifRouteLabel(route: OhifRoute): string {
  return route === "auto" ? "AUTO" : route === "lan" ? "LAN" : route === "tailscale" ? "TS" : "CUSTOM";
}

// ── Mixed-content safety ──────────────────────────────────────────────
/**
 * An <iframe> is *active* mixed content: an https page embedding http://host is
 * blocked by the browser outright (no warning, blank frame). A top-level
 * navigation — "open in a new tab" — is not blocked, so an http endpoint is
 * still reachable that way. This function is the whole rule, kept pure so it
 * can be tested without a browser.
 */
export function isEmbedSafe(endpoint: Pick<OhifEndpointInfo, "sameOrigin" | "secure">, pageProtocol: string): boolean {
  if (endpoint.sameOrigin) return true;
  if (endpoint.secure) return true;
  return pageProtocol !== "https:";
}

/**
 * Pick the endpoint THIS page should use.
 *
 * AUTO walks the server's preference order and returns the first candidate that
 * is both reachable and embed-safe here — so an https page never receives the
 * http LAN viewer. Manual routes force their candidate even when unreachable
 * (the caller must then show the failure, never paper over it).
 */
export function pickOhifEndpoint(
  status: OhifStatus | null,
  route: OhifRoute,
  pageProtocol: string,
): { endpoint: OhifEndpointInfo | null; blocked: OhifEndpointInfo | null } {
  if (!status) return { endpoint: null, blocked: null };

  if (route !== "auto") {
    const forced = status.endpoints.find((e) => e.key === route && e.configured) ?? null;
    return { endpoint: forced, blocked: null };
  }

  let blocked: OhifEndpointInfo | null = null;
  for (const ep of status.endpoints) {
    if (!ep.configured || ep.reachable !== true) continue;
    if (isEmbedSafe(ep, pageProtocol)) return { endpoint: ep, blocked };
    // Reachable but the browser would refuse to embed it — remember the first
    // one so the UI can explain the situation instead of looking broken.
    blocked ??= ep;
  }
  return { endpoint: null, blocked };
}

// ── Status fetch with a short cache ───────────────────────────────────
// Viewer chrome must not re-probe on every render: each route's status is held
// briefly and concurrent requests for the same route are deduped.

const CLIENT_TTL_MS = 30_000;
const ROUTE_STORAGE = "care-usg-ohif-route";

const statusCache = new Map<OhifRoute, { at: number; status: OhifStatus }>();
const inflight = new Map<OhifRoute, Promise<OhifStatus | null>>();

export function getCachedOhifStatus(route: OhifRoute = "auto"): OhifStatus | null {
  return statusCache.get(route)?.status ?? null;
}

/** Called after a settings save or a viewer load failure so the next launch
 * re-probes instead of trusting a stale route. */
export function invalidateOhifStatusCache(): void {
  statusCache.clear();
}

/**
 * Verify same-origin candidates from the browser — the only place that can
 * fetch our own proxy path without a CORS or mixed-content false negative.
 * The server deliberately leaves these at reachable:null.
 */
async function applyBrowserProbes(status: OhifStatus): Promise<OhifStatus> {
  const endpoints = await Promise.all(
    status.endpoints.map(async (ep) => {
      if (ep.probeBy !== "browser" || !ep.configured || ep.reachable !== null) return ep;
      try {
        const res = await fetch(ep.url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5_000) });
        // 405/501 means HEAD is unsupported, 403 that the viewer refuses the
        // verb — the route itself is being served either way.
        const reachable = res.ok || res.status === 403 || res.status === 405 || res.status === 501;
        return { ...ep, reachable, error: reachable ? undefined : `same-origin path responded ${res.status}` };
      } catch {
        return { ...ep, reachable: false, error: "same-origin viewer path is not being served" };
      }
    }),
  );
  return { ...status, endpoints };
}

/**
 * @param opts.force  ignore the cache — after a load failure or a settings
 *                    change, so AUTO can fail over to another endpoint at once.
 * @param opts.route  resolve a manual route server-side, so that endpoint's own
 *                    reachability is measured instead of inferred from AUTO.
 */
export async function fetchOhifStatus(
  opts: { force?: boolean; route?: OhifRoute } = {},
): Promise<OhifStatus | null> {
  if (typeof window === "undefined") return null;
  const route = opts.route ?? "auto";
  const hit = statusCache.get(route);
  if (!opts.force && hit && Date.now() - hit.at < CLIENT_TTL_MS) return hit.status;

  const pending = inflight.get(route);
  if (pending) return pending;

  const run = (async (): Promise<OhifStatus | null> => {
    const params = new URLSearchParams();
    if (opts.force) params.set("force", "1");
    if (route !== "auto") params.set("route", route);
    const qs = params.toString();
    try {
      const res = await fetch(`/api/usg/ohif/status${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      // On any failure keep the last known status rather than blanking the
      // viewer — a probe hiccup must never take the reporting workspace down.
      if (!res.ok) return hit?.status ?? null;
      const status = await applyBrowserProbes((await res.json()) as OhifStatus);
      statusCache.set(route, { at: Date.now(), status });
      return status;
    } catch {
      return hit?.status ?? null;
    } finally {
      inflight.delete(route);
    }
  })();

  inflight.set(route, run);
  return run;
}

/** Persist the manual route so a reload keeps the troubleshooting choice. */
export function readStoredOhifRoute(): OhifRoute {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(ROUTE_STORAGE);
    if (v === "lan" || v === "tailscale" || v === "custom" || v === "auto") return v;
  } catch {
    /* private mode / storage disabled — AUTO is the safe default */
  }
  return "auto";
}

export function storeOhifRoute(route: OhifRoute): void {
  try {
    window.localStorage.setItem(ROUTE_STORAGE, route);
  } catch {
    /* ignore */
  }
}
