# Runbook — 2026-10-30: "software is not reachable and data is not syncing"

**For the next agent, working on the clinic PC.** Written by the session that
received the report. **Nothing on the clinic system was changed by that session**
— no deploy, no restart, no container touched, no database written. Analysis only.

Reported symptom, in the operator's words: the USG studio "is not reachable" and
"data is not syncing" (bill-desk orders not arriving in the worklist).

---

## 0. Two addresses on the Synology — read this before trusting §1

**Correction, 12:20 IST.** The first version of this section said the clinic had
been renumbered and `172.16.1.139` was retired. **That was wrong**, and the
operator confirmed why: the Synology carries **both** addresses —
`172.16.1.139` on the clinic network, `192.168.1.137` on the other — which is
ordinary for a dual-NIC NAS. Nothing was renumbered.

The timeouts I read as "the address is dead" say more about the machine that ran
them: this PC is `192.168.0.109` with no route to `172.16.1.0/24`. **A timeout
proves nothing about a network until the address and the route are both
confirmed** — I made that mistake twice in one morning and wrote it into a file.

The measurement, read correctly:

| Target | via `192.168.1.137` | via `172.16.1.139` |
|---|---|---|
| Studio `:3040` | **200**, TTFB 0.036 s | no answer **from this PC — no route. Health unknown** |
| CARE ERP `:8888` | **200**, TTFB 0.009 s | as above |
| Orthanc `:8042` | **200**, 0.052 s | as above |
| OHIF `:3010` | **200** | as above |

**What survives the correction — and it is useful:**

1. **The studio and its database are healthy.** The same boot endpoint that took
   0.77–1.8 s and failed ~5 % of calls over the internet answered **18/18 in
   0.13–0.19 s** on the LAN (`http://192.168.1.137:3040/api/auth/state`). A
   contended SQLite file would be slow for the LAN caller too, so **§1's
   "requests that read SQLite are slow" is an access-path symptom, not a
   storage one.** The remote path — Cloudflare/tunnel, the clinic uplink, or
   Caddy's 96 M cap — is where that fault lives, and the tunnel is **outside**
   this compose project (its services are only `studio`, `caddy`, `chrome`).
2. **"Data is not syncing" goes back to §2 as the leading candidate.** A
   generated Prisma client that lags its own schema rejects every
   `UsgCareOrder` write with `Unknown argument` while reads, login and the sync
   banner all keep working — which is exactly "the app opens, the worklist
   never grows, and nothing says why". Production is only *proven* to contain
   #62; #63 (boot-time `prisma generate` + a readable failure reason) is
   unproven on the box.

**The tests that can separate the two remaining causes.** Run them from a machine
that is genuinely on `172.16.1.0/24`, and on the NAS itself — a container reaching
its own host's second address does not depend on this PC's routing at all:

```
ping -c 2 172.16.1.139
```
```
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://172.16.1.139:8888/
```
```
sudo ip -4 addr show | grep -E "172\.16|192\.168"
```
```
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 172.16.1.139 8888; echo care=$?'
```

If the NAS shows both addresses and that last line succeeds, then the configured
address is **correct**, the network is fine, and the sync fault is in the
build/code — go to §2 and §3. If `172.16.1.139` is gone from `ip addr`, or the
container cannot reach it, then the clinic segment, the switch/VLAN or the
second NIC is the fault, and no code change will fix it.

One code detail worth knowing either way, `src/lib/settings.ts:101-110`:

```ts
const CLINIC_LAN_HOST = (() => {
  const v = (process.env.CLINIC_LAN_HOST ?? "").trim();
  return v || "172.16.1.139";            // clinic default; both addresses are valid
})();
const LAN_DEFAULTS = {
  careApiBase: `http://${CLINIC_LAN_HOST}:8888`,
  orthancUrl:  `http://${CLINIC_LAN_HOST}:8042`,
  ohifLanUrl:  `http://${CLINIC_LAN_HOST}:3010`,
};
```

That is why blank Settings fields still produce a working CARE/Orthanc/OHIF
config. **Do not change these addresses on my recommendation** — with two valid
addresses on the box, `172.16.1.139` is a correct default, and switching it to
`192.168.1.137` would be a second, self-inflicted outage if the clinic devices
expect the first.

## 1. What was already measured — and the blind spot

Every number below came from a Windows PC at **192.168.0.109/24 (gateway
192.168.0.1)**. It reaches `192.168.1.0/24` — where the Synology also answers —
and it has **no route to the clinic segment `172.16.1.0/24`**, so every probe of
`172.16.1.139` from here timed out for a reason that says nothing about the
clinic. Both of that NAS's addresses are correct and in use; see §0. Treat
anything in this file that depends on `172.16.1.x` as **unverified**, and re-run
it from a machine that is actually on that network.

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

So the studio is **not down**. It answers, and over the internet the requests that
must read SQLite are slow (0.77 s for what should be <100 ms) and intermittently
die on a fixed ~5.6 s ceiling in bursts, then go quiet for ten minutes at a time.
**§0 showed the same endpoint answering in 0.13–0.19 s on the LAN**, so that
slowness and those 500s belong to the **remote access path**, not to the database.

**Ruled out by that evidence:** the container being dead, Node being wedged (401s
are instant), the TLS/DNS path, and — because the LAN was fast — SQLite
contention as the cause of the WAN symptoms. **Not ruled out: the Cloudflare
tunnel / clinic uplink**, which is precisely where the remaining difference
between 0.14 s and 0.77–1.8 s has to live, and which sits outside this compose
project. `/api/health` returns a hardcoded `{ok:true}` with no DB access —
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

**Answered on the NAS at 12:35 IST:** `9df0364 (HEAD -> main, origin/main)` — the
host working tree **is** at #65, so the source for the boot-time regeneration, the
cursor fix and the flood bound is on the box. That leaves the question sharp and
narrow: **is the running image built from it?** A container started from an image
older than the pull keeps the old entrypoint and the old generated client no
matter what `git log` says, and #63's `prisma generate` only ever runs at
container start. So `git log` alone can no longer answer §2 — the three greps in
§3 can, and they need no rebuild.

Two supporting facts to collect: `sudo docker ps --format "{{.Names}} {{.Status}}"`
(NOTES the container's uptime — started before the pull means the current image
was never booted), and the boot banner from §4 line 3.

## 3. Run the read-only probe (safe while the clinic is reporting)

`scripts/usg-sync-health.mjs` — added by this session and **tested against three
database shapes**: a matched schema (all `ok`), a database missing whole tables,
and a database with one dropped column. On the hostile two it reports each
section `UNREADABLE`/`MISSING` with the reason **and does not crash** — a previous
draft died mid-report inside a 200 KB Prisma stack, which is exactly how these
faults stay hidden.

**Correction, from the first attempt on the NAS.** `docker exec ... node
scripts/usg-sync-health.mjs` answered `Cannot find module
'/app/scripts/usg-sync-health.mjs'` — and that is my error, not a fault on the
box. The Dockerfile copies **scripts by name**, one `COPY` line each
(`usg-v4-cleanup`, `usg-v7-null-accession`, `pin-reset`,
`usg-prune-orthanc-orphans`), so any script added to the repo is invisible to the
running image until the image is rebuilt. A `COPY` line for this probe has been
added; until the next build, put the file in with `docker cp`, which needs no
rebuild and no restart:

```
cd /volume1/docker/usg-reports && git pull
```
```
sudo docker cp scripts/usg-sync-health.mjs usg-reporting-studio:/app/scripts/usg-sync-health.mjs
```
```
sudo docker exec -w /app usg-reporting-studio node scripts/usg-sync-health.mjs
```

`git pull` here moves the working tree to documentation plus one new script — no
application source, so nothing changes about the running app. The `docker cp` adds
one file to the container's filesystem; it disappears on the next recreate and
touches no data.

**The two checks that need nothing installed** — they read the image's own
generated client against the image's own schema, which is the exact disagreement
#63 was written to prevent:

```
sudo docker exec usg-reporting-studio grep -c usgSyncState /app/node_modules/.prisma/client/index.d.ts
```
```
sudo docker exec usg-reporting-studio grep -c "model UsgSyncState" /app/prisma/schema.prisma
```

`0` then a number ≥ `1` is the stale-client fault itself: the schema the image
carries knows the sync-state table, the generated client baked into
`node_modules/.prisma` does not, and every `UsgCareOrder`/`UsgSyncState` write
through that client is rejected while reads and login sail on. Both `0` means the
**image** predates #64 even though the host repo is at #65 — the build was never
re-run, which is the other half of "not deployed". If the first file turns out to
be absent, the same grep works on `/app/node_modules/.prisma/client/index.js`.

It writes nothing (counts and single-row reads only), prints no patient name, and
answers, from **inside the running image**, what `git log` on the host cannot:
does the deployed client agree with the deployed database.

**Do not accept `Up (healthy)` as proof the app works.** The image's healthcheck is
`wget --spider http://localhost:3000/api/health`, and that route returns a
hardcoded `{ok: true}` with **no database access** (`src/app/api/health/route.ts`).
A container can be green for weeks while every write fails.

Verdict map:

| Line | Meaning / next step |
|---|---|
| `MISSING UsgSyncState …` | image predates #64, or `db push` never ran → deploy, then restart so the entrypoint regenerates + pushes |
| `MISSING UsgReport.printSettingsJson …` | the running client expects a column the file lacks → **every report read can 500**. Restart the container; the entrypoint pushes the schema |
| `no sync row yet` | no CARE pull has ever completed on this DB |
| `lastSyncAt … min ago` > 30 | the sync is stalled; read `lastError` and `lastCareOk` on the same block. (`cursorHoldCount` on the same line is always 0 after §9 — it belonged to the watermark that was removed) |
| `newest order NONE` | mid-session this means the sync is not writing at all |
| `fallback=` in the hundreds | the Orthanc flood rows are still on the list → §5 |
| `SELECT 1` median > 30 ms | the **storage** is the bottleneck, not the code — see `-wal` size |
| `wal=` in the tens of MB | checkpoints are not completing; readers queue behind the log |
| `login background … KB` | that blob is re-sent to every unauthenticated load (217 KB body measured above) |

## 4. The one-line checks (send output back, one line at a time)

Long pasted blocks truncate on this terminal — **one command per line, no heredocs.**
Paste only what is inside a code block: labels written on the same line as a
command get executed as part of it (`172.16.1.x: curl …` became
`-sh: 172.16.1.x:: command not found`), and two of the address checks below were
typed with the wrong host in the URL as a result. Re-run them from the block, not
from the prose.

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
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 172.16.1.139 8888; echo care-clinic-segment=$?'
```
```
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 192.168.1.137 8888; echo care-other-segment=$?'
```
```
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://192.168.1.137:3040/api/auth/state
```

Line 2 is the whole diagnosis if it fires. Line 3 tells you whether **#63** is
deployed: a boot log containing `[studio] Regenerating Prisma client from
prisma/schema.prisma…` means it is; absence means the stale-client bug is live.
**Lines 5 and 6 are the pair that decides the address question**, because they ask
from *inside* the container rather than from my laptop: whatever
`careApiBase` says (probe, §3) must be the address that answers. If the configured
one fails and the other succeeds, the fix is the value, not the code. Line 7 is a
LAN baseline from any machine on that segment — it measured **0.13–0.19 s** here
against 0.77–1.8 s over the internet, so a slow studio at the desk is an access
fault, not a database one. Note `:3040` is Caddy's published port
(`docker-compose.yml:103`: `${STUDIO_PORT:-3040}:8090`); the studio itself is
`:3000` inside the network and is not published.

Because the NAS is dual-homed, "the NAS" is not one address: the studio's saved
`careApiBase`, the Orthanc and OHIF LAN fields, `CLINIC_LAN_HOST`
(`docker-compose.yml:24`, which feeds the built-in defaults when Settings is blank),
Caddy's `OHIF_UPSTREAM` (`docker-compose.yml:105`) and whatever the clinic PCs and
the USG machine use can each name a *different* one of the two. A saved value in
**Settings → Integrations always beats** the environment default, so check the
probe's `careApiBase=` line before changing any config. If a clinic PC cannot reach
the studio on the address it expects while the internet URL works, suspect that
mismatch or the clinic segment itself — not the application.

## 5. Ranked hypotheses

_Re-ranked at 12:25 IST after §0's correction. The address theory that led this
list is gone, because nothing was renumbered._

1. **The deployed image is older than #63/#64 → a stale generated Prisma client
   rejects every bill-desk write.** This is the best fit for "the app opens, the
   worklist never grows, and nothing says why": reads, login and the sync banner
   all keep working while every `UsgCareOrder` insert fails with `Unknown
   argument`. Production is only *proven* to contain #62. Discriminator: `git log
   -1` on the NAS, the `[studio] Regenerating Prisma client…` boot banner, and
   `MISSING UsgSyncState` from the probe.
2. **The remote access path** (Cloudflare tunnel/connector, the clinic uplink, or
   whatever port-forwards the studio) explains the second symptom — 0.77–1.8 s and
   ~5 % empty 500s over the internet against **0.13–0.19 s and 18/18 on the LAN**.
   The tunnel is not in this compose project, so it is outside this repository, and
   it is the one part of "not reachable" the LAN numbers cannot account for.
3. **An address the container cannot reach.** Not because the address is stale
   (both of the NAS's addresses are valid) but because the studio's configured
   `careApiBase` may name a segment the studio container itself has no path to.
   This is **unverified from my machine** — I have no route to `172.16.1.0/24`, so
   my timeouts there prove nothing (§0). Discriminator: §4 lines 5–6, run inside
   the container, read against the probe's `careApiBase=`.
4. **Write contention on single-writer SQLite.** In the #62-era code the worklist
   auto-sync fires **every 2 minutes, on mount and on window focus**, with no guard
   for "mounted but hidden behind the composer" (`UsgWorklistView.tsx:350,408` at
   `59c4721`), and the Orthanc fallback sweep is **14 days** with a per-study loop
   (`orthancClient.ts:138,198` at `59c4721`). #64 measured ~1,400 rows and hundreds
   of HTTP calls per cycle on this NAS. **Downgraded by the LAN measurement**: a
   contended database would be slow for the LAN caller too, and it was not. Keep it
   only if the probe's `SELECT 1` median comes back over 30 ms.
5. **`-wal` growth / checkpoint starvation** on the Synology volume → slow reads for
   everyone, including `SELECT 1`. Same caveat: the LAN was fast, so expect this to
   read clean.
6. **Container memory**: studio is capped at 512 M (`docker-compose.yml:94`) and
   this session's earlier batch added a `chromedp/headless-shell` sidecar capped at
   768 M (`usg-reporting-chrome`). The studio does **not** `depends_on` it and PDFs
   fall back to the built-in vector generator if it is down, but an image pull or a
   restart loop on a small NAS is a real load. Check `docker ps` status/counters —
   and remember a restart counter resets when a container is recreated, so it cannot
   prove "never crashed".
7. **The Settings guard from `a9bee9f`** — UI-only (`store.ts`, `SettingsView.tsx`,
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

## 8. Settled — the operator's own NAS evidence, later the same day

The next three commands answered it, and hypothesis 1 above was **wrong**: the
deployed image was `9df0364` (#65), both greps came back `29` and `1` (client and
schema agree), and both CARE addresses answered in `0.0005 s`. Nothing was stale
and nothing was unreachable. The probe's sync block was the story:

| Evidence (from the NAS, verbatim in the session) | Reading |
|---|---|
| `lastSyncAt 26696 min ago` | the watermark had not moved in **18.5 days** |
| `lastError 19 CARE order(s) failed to write … hold 1/10` | 19 rows kept being rejected; the counter that should give up after 10 holds was stuck at 1 |
| `docker logs`: `WL 11628: write rejected (P1008 · Socket timeout)` | the reason was **database contention**, not `Unknown argument` |
| `docker logs`: `[sync] repair pull — re-reading 72h` four cycles in a row | every cycle re-ran the heaviest possible pull |
| `care fetch: ok rows=448`, `Orthanc DICOMweb timed out`, `us=1079 … tooOld=776` | a 448-row write burst plus a 1,079-study sweep, per cycle |

**The loop.** A `P1008` timeout rejected the tail of the pull → `planCareCursor`
held the watermark → the hold branch also refused to stamp `lastDeepPullAt`
(`deepPullRan && cursorPlan.action === "advance"`), so the next cycle still
believed a repair pull was overdue → the 72-hour pull plus the 14-day Orthanc
sweep ran again against the same file and timed out again. The fault fed itself
and the only escape (ten consecutive holds) could never be counted, because the
same outage reset the counter every cycle.

**Why "not reachable" was the same fault.** SQLite was in its default
rollback-journal mode: one writer locks the file against every reader. A sync
writing hundreds of orders therefore stalled unrelated requests — including
`/api/auth/state`, which is exactly the 5 % of empty 500s at 5.6 s measured from
the internet, and it was happening while the LAN looked fine because the LAN
caller arrived between cycles.

## 9. What shipped for it, and the deploy

One change, four parts (`main` after this session):

1. **The watermark is gone.** `planWorklistPull` now asks CARE for a fixed
   `SYNC_LOOKBACK_DAYS = 3` window on every cycle and upserts. `planCareCursor`,
   `MAX_CURSOR_HOLDS`, `DEEP_PULL_*`, `worklistPullMode` and
   `servedAtFromPayload` are deleted; a row that fails to land is simply served
   again next cycle. `UsgSyncState.cursorHoldCount` and `lastDeepPullAt` stay as
   columns (this database holds finalized reports) but are vestigial, and the
   counter is pinned at 0.
2. **The Orthanc sweep is bounded** to `ORTHANC_SWEEP_DAYS = 7`, which matches
   `ORPHAN_MAX_AGE_DAYS` — the attach pass used to read 14 days of studies the
   very next step refused to act on. Auto-sync cadence went from 2 to 5 minutes.
3. **WAL is enabled on boot** — `docker-entrypoint.sh` runs
   `scripts/usg-enable-wal.mjs`, idempotent and never fatal.
4. **`log: ['query']` is off** unless `PRISMA_LOG_QUERIES=1`. It printed every
   statement with its parameters (patient names) and drowned the `P1008` line
   that was the entire diagnosis.

Deploy — the operator chooses the window; the studio is down for a few minutes:

```
cd /volume1/docker/usg-reports && git pull
```

```
sudo docker compose up -d --build studio
```

Then confirm from the probe (`journal_mode=wal`, `cursorHoldCount=0`,
`lastSyncAt` a few minutes old, and the 19 stuck orders present on the worklist):

```
sudo docker exec -w /app usg-reporting-studio node scripts/usg-sync-health.mjs
```

**Deliberately not done:** `usg-prune-orthanc-orphans.mjs --execute` (its dry run
found 1,218 of 2,301 rows to be Orthanc fallbacks, and with
`ORPHAN_MAX_AGE_DAYS = 3` a deletion would erase the only trace of scans that
were never billed — the operator reads the dry run first); the Cloudflare Access
policy for the open `ohif.caredeoghar.com/dicom-web`; moving the ~430 KB of
inline base64 out of the settings row. `reports_total=13` against
`drafts=11` and `finalized_last_24h=0` is still his to interpret.

## 10. Same day, after the operator set the rule

> **Read §11 before acting on this section.** Its first two bullets were wrong:
> the deleted mechanism was the outage safety net, and it has been restored.

Asked to go further — *"make the sync easier. link to bill should only be for
demography and doctor reference name"* — he took the option that removes the
mechanism rather than the identifier, and called it a trial: the full billing
rules can come back later, deliberately, one at a time.

- **An un-billed scan is no longer written as an order.** `importOrthancOrphans`,
  `ORPHAN_MAX_AGE_DAYS`, `nameDayKey` and `istDayOfDate` are deleted, with the
  orphan half of the sync's stats and toast. This is what made 1,218 of 2,301
  worklist rows; it cannot regrow, which is also why §6's `--execute` question is
  now optional tidying rather than a repair.
- **Un-billed scans reach a report from the queue instead.** The live PACS panel
  (DICOMweb, last 72 h) shows whenever Orthanc is configured — it used to hide
  whenever CARE had any rows — and **Draft** there is the only way such a study
  enters the order table. Matching by hard identifiers is untouched: name-based
  linking was explicitly rejected, because two same-named patients in one OPD day
  is routine here and a report on the wrong bill is not a fixable mistake.
- **A scan row claims nothing it does not have.** The `PACS-<uid>` string that
  `pacs-draft` wrote into `careWorklistId` is gone (null — it is not a bill-desk
  id), an accession in the DICOM header is never copied onto a row the ERP has
  not billed, and no code path invents `USG Study` as a test name any more. When
  CARE later bills that study, its real worklist id, accession and test name land
  on the same row through the StudyInstanceUID bridge.
- The worklist row now says **"Scan, not billed"** where it previously showed an
  identifier chip for a bill that does not exist.

## 11. Superseded by the operator — §10's first two bullets are wrong

The next probe run on the NAS, plus the CARE source, settled it. §10 deleted the
safety net on the premise that a worklist row with no CARE bill is an un-billed
scan. It is not.

- The operator's fact: **no scanned patient here is un-billed.** The USG machine
  follows no Modality Worklist and writes no accession number, so a study reaches
  the studio's list only when CARE's bridge serves its row.
- His own probe output said the net was working: the last cycle reported
  `202 new from CARE · 31 new from Orthanc · 461 linked by StudyInstanceUID ·
  1807 awaiting images` — studies were arriving in the PACS faster than CARE was
  serving them. Deleting `importOrthancOrphans` would have made those patients
  invisible at the desk rather than fixing anything. Restored in `6c74ac3`,
  bounded, still claiming nothing bill-shaped.
- #64 already said this in 2026 and I read it as a feature note: *"those are the
  emptier copy of patients CARE had already sent"*. The flood was a symptom of
  the stalled pull, not the net's purpose.
- CARE's side, verified rather than summarised: `radiology_worklist` is written
  by **one** INSERT (`internal-radiology.ts:993`, provenance `PACS_INTAKE`); the
  bill desk never touches it (registration fans out `radiology_studies`); the
  studio bridge reads that mirror and joins the bill to it by accession,
  `study_id`, then a guarded **name + date ±1 + modality single hit**
  (`studioWorklistBillJoin.ts:490-520`) before serving
  `studyInstanceUid`/`matchedKey`/`billNumber` per row
  (`internal-reporting-studio.ts:446-467`). The scanner→ERP pipe is the deployed
  `care-pacs/care-erp-sync` sidecar (`ORTHANC_CHANGES_POLLER=false` on purpose,
  `care.env:72-73`), and `STAMP_ACCESSION_FROM_BILL` — which writes the bill
  number into DICOM 00080050 for single-hit empty-accession studies, refusing
  multi-hit and name-only matches — is **default off**.
- **What was right in §10 stays.** `pacs-draft` no longer writes a synthetic
  `PACS-<uid>` into `careWorklistId`, the DICOM accession is never copied onto a
  row CARE has not served, no code invents `USG Study`, and the PACS panel shows
  whenever Orthanc is configured. The chip now reads **"Not in CARE yet"**, which
  is the claim this app can actually make.

### The join this clinic needs, built at last

`planDemographicLinks` / `linkOrdersByDemography` (careSync.ts) run after the
identifier passes and before the safety net: one bill row and one study agreeing
on patient name + the clinic's IST scanning day are linked, and the referring
doctor's name is the only tie-breaker when either side has duplicates. Anything
that still has two candidates is left unlinked and counted — the sync log, the
audit line and the toast all report `linked by patient + date` and
`N same name/day — left for you to match`. It writes `studyInstanceUid` and no
other field, so a link cannot rewrite what CARE said. Both refusal branches were
mutated and the tests caught them (`tests/demographicLink.test.ts`, 15 tests).

### The measurement that decides what to fix upstream

The probe now prints `care_rows | care_rows_with_uid | no_uid`. Run it against
the deployed image (`git pull && docker compose up -d --build studio`, or `docker
cp scripts/usg-sync-health.mjs` for the script alone):

- **Billed rows carry a UID** → CARE's intake is delivering; the studio should
  join by identifier, the safety net should be near-quiet each cycle, and a
  persistent `not in CARE yet` count means the studio's own window or writes.
- **Billed rows carry no UID** → the gap is upstream: is `care-erp-sync` running
  and its intake authenticated, and are CARE's mirror rows reaching the ERP's
  bill-link tiers at all? That is a CARE change (or switching on the guarded
  stamping flag), not something this app can invent its way around.
