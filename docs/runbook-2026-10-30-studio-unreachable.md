# Runbook — 2026-10-30: "software is not reachable and data is not syncing"

**For the next agent, working on the clinic PC.** Written by the session that
received the report. **Nothing on the clinic system was changed by that session**
— no deploy, no restart, no container touched, no database written. Analysis only.

Reported symptom, in the operator's words: the USG studio "is not reachable" and
"data is not syncing" (bill-desk orders not arriving in the worklist).

---

## 1. What was already measured — and the blind spot

Every number below came from a Windows PC at **192.168.0.109/24 (gateway
192.168.0.1)**. **That machine is NOT on the clinic LAN** (`172.16.1.0/24`). All
four LAN probes to `172.16.1.139` (ports 3040 / 8888 / 8042 / 3010) timed out
from there, which proves nothing about the clinic — only that the measuring
machine was elsewhere. **The LAN side is your job.**

Measured 2026-10-30, 11:32–11:47 IST, over the internet via Cloudflare:

| Probe | Result |
|---|---|
| `https://usg.caredeoghar.com/` | **200**, TTFB 0.61 s, 4/4 attempts |
| `https://ohif.caredeoghar.com/` | **200** → the NAS is up and its proxy path is intact |
| `https://usg.caredeoghar.com/api/auth/state` | **5–6 failures ≈ 5 %** (never in a burst of one: 11:36:51, 11:37:19, 11:37:33 plus two earlier) |
| …each failure | **empty body, exactly 5.6 s** (5.607 / 5.614 / 5.621 s) |
| …successful calls | TTFB **0.75–0.82 s**, body **217,822 bytes** |
| `/api/usg/worklist`, `/api/settings` | **401 instantly** (they refuse before touching the DB) |
| 63 further samples over 11 minutes | 63/63 = 200 |

So the studio is **not down**. It answers, and the requests that must read SQLite
are slow (0.77 s for what should be <100 ms) and intermittently die on a fixed
~5.6 s ceiling in bursts, then go quiet for ten minutes at a time.

**Ruled out by that evidence:** the container being dead, Cloudflare/tunnel being
broken, Caddy being misconfigured, Node being wedged (401s are instant), and the
TLS/DNS path. `/api/health` returns a hardcoded `{ok:true}` with no DB access —
**do not trust it as a health signal.**

Why the boot endpoint touches the DB three times: `src/app/api/auth/state/route.ts:6-10`
(`ensureSeed`, then `getSession()` — which reads the `Session` table on *every*
request, `src/lib/auth.ts:58` — then `getSettings()`).

## 2. The question that decides the diagnosis

Production provably contains PR **#62** (`/api/auth/state` returns a `demoPin`
field that only `59c4721` added). It is **unproven** whether it contains the three
later commits, which are on `origin/main` and which describe these exact symptoms:

```
59c4721 #62 fix(auth): a studio on the demo PIN can finish setup again   <-- provably deployed
cfed0c0 #63 fix(sync): regenerate the Prisma client at boot, and say why a write failed
c91b776 #64 fix(usg): stop the sync cursor outrunning the writes, and bound the Orthanc flood
9df0364 #65 fix(usg): the billed format is applied to a draft that already exists
```

#63's own message: the studio ran **four days** with a generated Prisma client that
lagged its schema; every `UsgCareOrder` insert was rejected with
`Unknown argument testCode` while **reads, login and the sync banner kept working**,
so the worklist silently stopped growing and 1,369 of 1,374 studies were lost.
Before that fix the failure log was `message.split("\n")[0]` of an error that
begins with a blank line, i.e. the container logged **`create failed ()`** — silent.

If the box is at #62, both reported symptoms are already explained and the fix is
a deploy. Establish this **first**:

```
cd /volume1/docker/usg-reports && git log --oneline -1
```

## 3. Run the read-only probe (safe while the clinic is reporting)

`scripts/usg-sync-health.mjs` — added by this session and **tested against three
database shapes**: a matched schema (all `ok`), a database missing whole tables,
and a database with one dropped column. On the hostile two it reports each
section `UNREADABLE`/`MISSING` with the reason **and does not crash** — a previous
draft died mid-report inside a 200 KB Prisma stack, which is exactly how these
faults stay hidden.

```
sudo docker exec -w /app usg-reporting-studio node scripts/usg-sync-health.mjs
```

It writes nothing (counts and single-row reads only), prints no patient name, and
answers, from **inside the running image**, what `git log` on the host cannot:
does the deployed client agree with the deployed database.

Verdict map:

| Line | Meaning / next step |
|---|---|
| `MISSING UsgSyncState …` | image predates #64, or `db push` never ran → deploy, then restart so the entrypoint regenerates + pushes |
| `MISSING UsgReport.printSettingsJson …` | the running client expects a column the file lacks → **every report read can 500**. Restart the container; the entrypoint pushes the schema |
| `no sync row yet` | no CARE pull has ever completed on this DB |
| `lastSyncAt … min ago` > 30 | the sync is stalled; read `lastError`, `cursorHoldCount`, `lastCareOk` on the same block |
| `newest order NONE` | mid-session this means the sync is not writing at all |
| `fallback=` in the hundreds | the Orthanc flood rows are still on the list → §5 |
| `SELECT 1` median > 30 ms | the **storage** is the bottleneck, not the code — see `-wal` size |
| `wal=` in the tens of MB | checkpoints are not completing; readers queue behind the log |
| `login background … KB` | that blob is re-sent to every unauthenticated load (217 KB body measured above) |

## 4. The six one-line checks (send output back, one line at a time)

Long pasted blocks truncate on this terminal — **one command per line, no heredocs.**

```
sudo docker ps --format "{{.Names}} {{.Status}}"
```
```
sudo docker logs --tail 500 usg-reporting-studio 2>&1 | grep -iE "Regenerating Prisma|Unknown argument|does not exist|database is locked|busy|create failed|P20" | tail -20
```
```
sudo docker logs --tail 30 usg-reporting-studio
```
```
sudo docker exec usg-reporting-studio sh -c 'ls -la /app/data/db'
```
```
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 172.16.1.139 8888; echo care=$?'
```
```
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://172.16.1.139:3040/api/auth/state
```

Line 2 is the whole diagnosis if it fires. Line 3 tells you whether **#63** is
deployed: a boot log containing `[studio] Regenerating Prisma client from
prisma/schema.prisma…` means it is; absence means the stale-client bug is live.
Line 6 is run **from the clinic PC** and is the only honest LAN test — from here
the studio answered 200 over the internet while this machine could not see
`172.16.1.x` at all. Note `:3040` is Caddy's published port
(`docker-compose.yml`: `${STUDIO_PORT:-3040}:8090`); the studio itself is `:3000`
inside the network and is not published.

If the LAN URL fails from a clinic PC while the internet URL works, suspect the
**network, not the app**: the NAS IP, the switch/VLAN, or a renumbered subnet. The
deployment knob for that is `CLINIC_LAN_HOST` in `docker-compose.yml` (it feeds the
built-in CARE/Orthanc/OHIF defaults), and anything saved in **Settings →
Integrations overrides it** — which is how a moved NAS becomes "data is not
syncing" while the app itself looks fine.

## 5. Ranked hypotheses

1. **Deployed image is older than #63/#64** → stale Prisma client rejects every
   bill-desk write (symptom 2) and the unguarded sync storm still saturates SQLite
   (symptom 1). Discriminator: `git log -1`, the boot banner, and `MISSING
   UsgSyncState` from the probe.
2. **Write contention on single-writer SQLite.** In the #62-era code the worklist
   auto-sync fires **every 2 minutes, on mount and on window focus**, with no guard
   for "mounted but hidden behind the composer" (`UsgWorklistView.tsx:350,408` at
   `59c4721`), and the Orthanc fallback sweep is **14 days** with a per-study loop
   (`orthancClient.ts:138,198` at `59c4721`). #64 measured ~1,400 rows and hundreds
   of HTTP calls per cycle on this NAS. Bursts of exactly-5.6 s failures that vanish
   for ten minutes match a periodic job, and fit the 2-minute cadence.
3. **`-wal` growth / checkpoint starvation** on the Synology volume → slow reads
   for everyone, including `SELECT 1`.
4. **Container memory**: studio is capped at 512 M (`docker-compose.yml:94`) and
   this session's earlier batch added a `chromedp/headless-shell` sidecar capped at
   768 M (`usg-reporting-chrome`). The studio does **not** `depends_on` it and PDFs
   fall back to the built-in vector generator if it is down, but an image pull or a
   restart loop on a small NAS is a real load. Check `docker ps` status/counters —
   and remember a restart counter resets when a container is recreated, so it cannot
   prove "never crashed".
5. **A clinic-network change** (subnet, NAS IP, VLAN) — only the LAN test in §4 can
   show it.
6. **The Settings guard from `a9bee9f`** — UI-only (`store.ts`, `SettingsView.tsx`,
   `AppShell.tsx`), no DB, no deps, no compose. It cannot reach
   `/api/auth/state`, and the failing endpoint does not call anything it touched.

## 6. Hard stops

- **Do not deploy or restart without the operator's explicit go-ahead, and not
  while patients are being reported** (clinic opens 08:30 IST; a rebuild takes
  minutes and the studio is unusable during it). Ask which window he wants.
- **Never** `prisma db push --accept-data-loss`, and never edit
  `docker-entrypoint.sh` to add it. That flag is absent on purpose: the database
  holds finalized reports, and the entrypoint **fails startup deliberately** when a
  change would drop data. If it is failing to start, that is the guard working.
- `scripts/usg-prune-orthanc-orphans.mjs` **defaults to a dry run**; `--execute`
  deletes. Never run `--execute` before the dry-run output is read by the operator,
  and never against a list you have not shown him.
- Do not touch `data/db` contents, do not `docker compose down` (it drops the
  network and the operator loses the studio mid-session), no `--force-recreate`.
- Back up before any schema action: copy `data/db/` first, then verify the copy
  exists. Never on a schedule you invented — say what you copied and where.
- **PHI and secrets:** the probe prints no patient names, but `UsgSyncState.lastError`
  is server-generated text; it is truncated to 160 chars for that reason — do not
  paste a longer version into an issue. Never echo a PIN, `CARE_API_KEY`, or the
  GitHub token into a log, a PR body, or this file.
- Still open from an earlier session, unrelated to this incident:
  `ohif.caredeoghar.com/dicom-web` is unauthenticated and publicly readable (PHI).
  The Cloudflare Access policy is the operator's to apply; the studio already
  tolerates the 401 it will return. If Access is ever applied to the **whole zone**,
  the studio itself starts 403-challenging — that would look exactly like "software
  is not reachable". Test 6 in §4 distinguishes them: a 403/HTML challenge from the
  LAN URL means a policy, a timeout means the network.

## 7. Report back in this shape

1. `git log --oneline -1` on the NAS, verbatim.
2. Full probe output.
3. The grep from §4 line 2, verbatim (empty is a result — say it was empty).
4. `ls -la /app/data/db` output.
5. Which §4 LAN checks passed/failed **and from which machine**, with its IP.
6. What you changed, if anything — ideally nothing.

Do not conclude "the app is fine" from a 200 on `/`. It was 200 and failing 5 % of
boot calls at 11:37 this morning.
