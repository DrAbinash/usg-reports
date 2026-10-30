# Runbook — 2026-10-30: "software is not reachable and data is not syncing"

**For the next agent, working on the clinic PC.** Written by the session that
received the report. **Nothing on the clinic system was changed by that session**
— no deploy, no restart, no container touched, no database written. Analysis only.

Reported symptom, in the operator's words: the USG studio "is not reachable" and
"data is not syncing" (bill-desk orders not arriving in the worklist).

---

## 0. Root-cause candidate found at 12:12 IST — check this before anything else

**The clinic network has been renumbered, and the studio's saved integration
addresses were left behind.** The NAS answers on **`192.168.1.137`**; every
address this repository assumes — `172.16.1.139`, which is what `.env.example:13`
(`CARE_API_BASE`), the compose defaults and the built-in OHIF/Orthanc LAN fallbacks
all carry — **no longer answers anything at all.**

Measured from this PC (`192.168.0.109`), which *can* route `192.168.1.0/24` —
an earlier note in this file said the opposite; that was wrong, and the correction
is what found the fault:

| Target | `192.168.1.137` (where the NAS actually is) | `172.16.1.139` (where the config says it is) |
|---|---|---|
| Studio `:3040` | **200**, TTFB 0.036 s | **no answer** |
| CARE ERP `:8888` | **200**, TTFB 0.009 s | **no answer** |
| Orthanc `:8042` | **200** (`/studies`), 0.052 s | — |
| OHIF `:3010` | **200** root | — |

And the same boot endpoint, from the same machine, two ways:

| Path | Result |
|---|---|
| LAN `http://192.168.1.137:3040/api/auth/state` | **18/18 = 200, TTFB 0.13–0.19 s** |
| WAN `https://usg.caredeoghar.com/api/auth/state` | **0.77–1.8 s** (clean in the 12:13 window; ~5 % of calls returned an empty 500 after exactly 5.6 s in the 11:36–11:37 window) |

**Why that explains both reported symptoms:**

1. **"Data is not syncing."** If `HospitalSettings.careApiBase` still reads
   `http://172.16.1.139:8888`, every CARE pull connects to a retired address. A
   dropped/blackholed address does not fail fast — it waits for the connect
   timeout, so the sync burns seconds on each attempt and writes nothing. The
   worklist simply stops growing while the app looks healthy. **The probe prints
   this value in one line** (§3, `careApiBase=…`) — read that before believing
   anything else in this runbook.
2. **"Software is not reachable."** Anyone opening the studio by the old LAN
   address (`http://172.16.1.139:3040`) gets a hang, not an error. Over the
   internet the app *is* reachable, but 5–10× slower than on the LAN and briefly
   throwing 500s — so the fault is in the access path, and the app+database are
   **not** the bottleneck: 0.14 s TTFB on the LAN for the same three-query
   endpoint kills the "SQLite contention" theory as the primary cause.

**Fix shape (the operator's to approve — do not apply it yourself mid-session):**
the mechanism is in the code, `src/lib/settings.ts:101-110`:

```ts
const CLINIC_LAN_HOST = (() => {
  const v = (process.env.CLINIC_LAN_HOST ?? "").trim();
  return v || "172.16.1.139";            // <-- the retired address, still the default
})();
const LAN_DEFAULTS = {
  careApiBase: `http://${CLINIC_LAN_HOST}:8888`,
  orthancUrl:  `http://${CLINIC_LAN_HOST}:8042`,
  ohifLanUrl:  `http://${CLINIC_LAN_HOST}:3010`,
};
```

So on a NAS where `CLINIC_LAN_HOST` was never set and nothing was saved in the
app, **all three integration targets default to a dead address** — CARE pulls time
out, Orthanc looks empty, and the viewer route has nothing to build from. Two
routes to the fix, in order of preference:

1. `CLINIC_LAN_HOST=192.168.1.137` in the NAS `.env`, then a restart of the studio
   service only. Applies when the Settings fields were left blank.
2. **Settings → Integrations** in the studio (care base `http://192.168.1.137:8888`,
   Orthanc `http://192.168.1.137:8042`, OHIF LAN `http://192.168.1.137:3010`).
   A saved value **always beats** the environment default, so if the fields are
   already filled with `172.16.1.139`, option 1 will look like it did nothing —
   which is why the probe's `careApiBase=` line must be read first.

Also check whatever publishes `usg.caredeoghar.com` (a Cloudflare tunnel/connector)
— it lives **outside** this compose project (services here are only `studio`,
`caddy`, `chrome`), so a stale tunnel ingress rule is part of the same renumbering
and would explain the WAN 500s and the 5× penalty. And the code default itself
(`src/lib/settings.ts:103`) plus `.env.example:13,18,26`, `docker-compose.yml:23`
and `:105` (`OHIF_UPSTREAM` default) and six Settings hints/placeholders still name
the retired address — worth one cleanup commit so the next clinic renumbering is not
silent again, but that is a separate change from restoring service today.

## 1. What was already measured — and the blind spot

Every number below came from a Windows PC at **192.168.0.109/24 (gateway
192.168.0.1)**, which routes `192.168.1.0/24` fine. Its first round of LAN probes
to **`172.16.1.139`** all timed out, and this file originally read that as "the
measuring machine is off the clinic network". **That reading was wrong** — the
machine reaches the clinic; the address it was told to reach has been retired. See
§0. Keep the lesson: a timeout proves nothing about the network until you have
confirmed the address, and I nearly reported a false blind spot.

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
**§0 later showed the same endpoint answering in 0.14 s on the LAN**, which moves
the blame from the database to the access path and the stale addresses.

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

## 4. The one-line checks (send output back, one line at a time)

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
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 192.168.1.137 8888; echo care-new=$?'
```
```
sudo docker exec usg-reporting-studio sh -c 'nc -vz -w3 172.16.1.139 8888; echo care-old=$?'
```
```
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://192.168.1.137:3040/api/auth/state
```

Line 2 is the whole diagnosis if it fires. Line 3 tells you whether **#63** is
deployed: a boot log containing `[studio] Regenerating Prisma client from
prisma/schema.prisma…` means it is; absence means the stale-client bug is live.
**Lines 5 and 6 together are the test for §0**: they ask the *container* — not this
PC — whether CARE is alive at the address the studio is configured to use. Read
them as a pair against `careApiBase` from the probe: new answers / old does not,
and the saved value says old, is the fault. Note `:3040` is Caddy's published port
(`docker-compose.yml:103`: `${STUDIO_PORT:-3040}:8090`); the studio itself is
`:3000` inside the network and is not published.

Line 7 is run **from a clinic machine** and is the honest LAN baseline: it answered
0.13–0.19 s TTFB from here, against 0.77–1.8 s over the internet, so a slow or
failing studio at the desk is an access-path fault, not a database one.

If the LAN URL fails from a clinic PC while the internet URL works, suspect the
**network, not the app**: the NAS IP, the switch/VLAN, or a renumbered subnet. The
deployment knob for that is `CLINIC_LAN_HOST` in `docker-compose.yml` (it feeds the
built-in CARE/Orthanc/OHIF defaults), and anything saved in **Settings →
Integrations overrides it** — which is how a moved NAS becomes "data is not
syncing" while the app itself looks fine.

## 5. Ranked hypotheses

1. **The clinic was renumbered and the studio's saved addresses were not updated**
   (§0). `172.16.1.139` — the address `.env.example:13`, the compose defaults and
   the built-in CARE/Orthanc/OHIF fallbacks all carry — answers nothing, while the
   same services answer in under 60 ms on `192.168.1.137`. Explains "not syncing"
   (pulls time out against a retired IP) and "not reachable" (anyone using the old
   LAN URL hangs). Discriminator: `careApiBase` from the probe, plus §4 lines 5–6
   asked *from inside the container*. This is now the leading candidate because it
   is directly measured, not inferred.
2. **Deployed image is older than #63/#64** → a stale Prisma client rejects every
   bill-desk write, and the unguarded sync storm still loads SQLite. Independent of
   #1 and possibly true *at the same time*: the fixes are on `main` but production
   is only proven to carry #62. Discriminator: `git log -1`, the boot banner, and
   `MISSING UsgSyncState` from the probe.
3. **The remote access path** (Cloudflare tunnel/connector, uplink, or the
   port-forward that publishes the studio). The LAN measured 0.13–0.19 s and 18/18
   successes; the internet path of the same endpoint measured 0.77–1.8 s with ~5 %
   empty 500s at exactly 5.6 s. The tunnel is **not** in this compose project, so
   it is outside this repository — and it is the one part of "not reachable" the LAN
   numbers cannot explain.
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
