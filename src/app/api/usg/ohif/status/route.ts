import { requireSession } from "@/lib/auth";
import { resolveOhifStatus } from "@/lib/usg/ohifResolver";
import type { OhifRoute } from "@/lib/usg/ohifLaunch";

const ROUTES: readonly string[] = ["auto", "lan", "tailscale", "custom"];

/**
 * Viewer routing status for the studio: which endpoints are configured, which
 * are reachable, and which one AUTO picked. Configuration + reachability only —
 * no secrets, and no endpoint that the clinic has not configured.
 *
 * ?force=1 bypasses the reachability cache (after a settings change or a load
 * failure); ?route=lan|tailscale|custom resolves a manual route so its real
 * state can be shown instead of the AUTO result.
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const params = new URL(req.url).searchParams;
  const force = /^(1|true)$/i.test(params.get("force") ?? "");
  const route = params.get("route") ?? "";
  const routeOverride = ROUTES.includes(route) ? (route as OhifRoute) : undefined;

  return Response.json(await resolveOhifStatus({ force, routeOverride }));
}
