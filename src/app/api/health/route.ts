import { db } from "@/lib/db";

/**
 * The container's health probe — and until now it could never be unhealthy.
 *
 * It answered `200 {"ok":true}` without touching anything, so during the 30 Oct
 * outage `docker ps` read "(healthy)" for a studio whose every write was being
 * rejected with P1008 by a locked SQLite file. A check that cannot fail is not a
 * check; this one runs a query and says what happened.
 *
 * Nothing here is PHI and nothing is a secret: a status, a row count is NOT
 * included (it would tell an unauthenticated poller how many patients this
 * clinic has), and the error text is Prisma's class name, never its echoed data.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    // A read that goes through the same single-writer file the app depends on:
    // if a lock is holding readers out, this is what times out — which is exactly
    // the failure the old response was built not to notice.
    await db.$queryRaw`SELECT 1 FROM UsgCareOrder LIMIT 1`;
    return Response.json(
      { ok: true, app: "CARE USG Studio", db: "ok", ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const name = e instanceof Error ? e.constructor.name : "Unknown";
    const code = (e as { code?: string } | null)?.code ?? "";
    return Response.json(
      {
        ok: false,
        app: "CARE USG Studio",
        db: "unreachable",
        // P1008 is a Prisma socket timeout — the signature of a locked or sick
        // database file, which is the outage this is meant to catch.
        reason: code || name,
        ms: Date.now() - startedAt,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
