/**
 * End-to-end integration verification for the CARE Reporting Studio fixes.
 *
 * Boots the REAL standalone Next.js server against a scratch SQLite DB, plus
 * three mock backends on loopback that emulate the Synology reality:
 *
 *   CARE mock     : /api/internal/reporting-studio/ping → 401 without a key,
 *                   200 {"ok":true} with the correct x-api-key
 *   Orthanc mock  : /system → 200 {"Name","Version"}, /studies → [ids],
 *                   /studies/{id} → study resource with MainDicomTags
 *                   (and 404 for /api/* to prove we no longer call those)
 *   OHIF mock     : HEAD → 405 (nginx that rejects HEAD), GET → 200
 *                   (proves the fallback path)
 *
 * Then drives the app through its REAL HTTP API: setup PIN → save
 * integrations (with pasted whitespace + blank-secret re-save) → run all
 * three connection tests → reload settings → worklist sync.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = "/home/z/my-project/mri-reports-push";
const APP_PORT = 3901;
const CARE_PORT = 18888;
const ORTHANC_PORT = 18042;
const OHIF_PORT = 13010;
const API_KEY = "e2e-test-key-xyz";

const ok = (cond, msg) => {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok  ${msg}`);
  }
};

let cookie = "";

async function app(method, pathName, body) {
  const res = await fetch(`http://127.0.0.1:${APP_PORT}${pathName}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0];
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

// ── mock backends ─────────────────────────────────────────────────────────
const servers = [];

function start(name, port, handler) {
  const srv = http.createServer(handler);
  servers.push(srv);
  return new Promise((resolve, reject) => {
    srv.once("error", reject);
    srv.listen(port, "127.0.0.1", () => resolve());
  }).then(() => console.log(`  [mock ${name}] listening on :${port}`));
}

const studyResource = {
  ID: "e2e-study-1",
  MainDicomTags: {
    StudyInstanceUID: "1.2.840.113619.2.55.3.2831183777.781.1676812345.101",
    AccessionNumber: "CARE-24081",
    StudyDate: "20260830",
    StudyDescription: "MRI LUMBOSACRAL SPINE",
  },
  ParentPatient: "e2e-patient-1",
  Series: [],
};

async function main() {
  console.log("== 1. scratch DB ==");
  const tmp = path.join(ROOT, "tests", ".tmp");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execSync("npx prisma db push --skip-generate", {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${path.join(tmp, "e2e.db")}` },
  });
  console.log("  ok  schema pushed to scratch SQLite");

  console.log("== 2. mock backends ==");
  await start("CARE", CARE_PORT, (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${CARE_PORT}`);
    const authorized = req.headers["x-api-key"] === API_KEY;
    if (url.pathname === "/api/internal/reporting-studio/ping") {
      if (authorized) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: "1.3.0-e2e" }));
      } else {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
      }
      return;
    }
    if (url.pathname === "/api/internal/reporting-studio/worklist") {
      if (!authorized) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      // One order matching the mock Orthanc study's AccessionNumber —
      // exercises the accession-matching promote path in the sync route.
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([
        {
          worklistId: "wl-e2e-1",
          accessionNumber: studyResource.MainDicomTags.AccessionNumber,
          patientName: "E2E Patient",
          patientAge: "44/F",
          patientGender: "F",
          referringDoctor: "Dr. E2E",
          testName: "MRI Lumbosacral Spine",
          modality: "MR",
          studyDate: "2026-08-30T06:00:00.000Z",
          studyInstanceUid: studyResource.MainDicomTags.StudyInstanceUID,
          billingStatus: "PAID",
        },
      ]));
      return;
    }
    if (url.pathname === "/api/internal/reporting-studio/billing-status") {
      if (!authorized) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({}));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `no route ${url.pathname}` }));
  });

  await start("Orthanc", ORTHANC_PORT, (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${ORTHANC_PORT}`);
    // The OLD buggy paths must still 404 — proves the fix stopped calling them
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ Message: "Unknown resource" }));
      return;
    }
    if (url.pathname === "/system") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ Name: "Orthanc", Version: "1.12.5-e2e", DatabaseVersion: 6 }));
      return;
    }
    if (url.pathname === "/studies") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([studyResource.ID]));
      return;
    }
    if (url.pathname === `/studies/${studyResource.ID}`) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(studyResource));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ Message: "Unknown resource" }));
  });

  await start("OHIF", OHIF_PORT, (req, res) => {
    if (req.method === "HEAD") {
      res.writeHead(405); // exercises the GET fallback
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html>OHIF mock</html>");
  });

  console.log("== 3. boot standalone server ==");
  const child = spawn("node", ["server.js"], {
    cwd: path.join(ROOT, ".next", "standalone"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(APP_PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: `file:${path.join(tmp, "e2e.db")}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (d) => process.stderr.write(`[app] ${d}`));
  const killApp = () => { try { child.kill("SIGKILL"); } catch { /* already gone */ } };
  process.on("exit", killApp);
  process.on("SIGINT", () => { killApp(); process.exit(130); });
  process.on("SIGTERM", () => { killApp(); process.exit(143); });

  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r = await fetch(`http://127.0.0.1:${APP_PORT}/api/health`);
      up = r.ok;
    } catch { /* retry */ }
  }
  if (!up) { console.error("  FAIL: app never became healthy"); process.exit(1); }
  console.log("  ok  app healthy");

  try {
    console.log("== 4. login (fresh DB seeds demo PIN 123456) ==");
    let r = await app("POST", "/api/auth/login", { pin: "123456" });
    console.log("     login ->", r.status, JSON.stringify(r.json), "cookie:", cookie ? "captured" : "NONE");
    ok(r.status === 200 && r.json?.ok === true, "login works (also seeds demo data)");

    console.log("== 5. save integrations (with paste artifacts) ==");
    r = await app("PUT", "/api/settings", {
      careApiBase: `  http://127.0.0.1:${CARE_PORT} `,
      careApiKey: `  ${API_KEY} \n`,
      orthancUrl: ` http://127.0.0.1:${ORTHANC_PORT}/ `,
      orthancUsername: "",
      orthancPassword: "",
      ohifLanUrl: `http://127.0.0.1:${OHIF_PORT}`,
    });
    const saved = r.json?.settings;
    ok(r.status === 200, "PUT /api/settings returns 200");
    ok(saved?.careApiBase === `http://127.0.0.1:${CARE_PORT}`, `careApiBase persisted (trimmed) -> ${saved?.careApiBase}`);
    ok(saved?.orthancUrl === `http://127.0.0.1:${ORTHANC_PORT}/`, `orthancUrl persisted -> ${saved?.orthancUrl}`);
    ok(saved?.ohifLanUrl === `http://127.0.0.1:${OHIF_PORT}`, `ohifLanUrl persisted -> ${saved?.ohifLanUrl}`);
    ok(saved?.careApiKeySet === true && !("careApiKey" in (saved ?? {})), "key saved but masked in response");
    ok(!("orthancPassword" in (saved ?? {})) && !("pinHash" in (saved ?? {})), "no secrets in response");

    console.log("== 6. re-save with BLANK secrets (must keep them) ==");
    r = await app("PUT", "/api/settings", { careApiKey: "", orthancPassword: "", appTitle: "CARE Reporting Studio" });
    const resaved = r.json?.settings;
    ok(resaved?.careApiKeySet === true, "blank API key kept the existing key");
    ok(resaved?.orthancPasswordSet === false, "orthanc password flag reflects 'never set'");

    console.log("== 7. CARE test (server-side key, real route) ==");
    r = await app("POST", "/api/settings/test", { target: "care" });
    ok(r.json?.ok === true && r.json?.message === "CARE reachable", `CARE test -> ${JSON.stringify(r.json)}`);

    console.log("== 8. CARE 401 surfaced when key is wrong ==");
    await app("PUT", "/api/settings", { careApiKey: "wrong-key" });
    r = await app("POST", "/api/settings/test", { target: "care" });
    ok(r.json?.ok === false && r.json?.error === "CARE responded 401: unauthorized",
      `401 surfaced -> ${JSON.stringify(r.json)}`);
    await app("PUT", "/api/settings", { careApiKey: API_KEY }); // restore

    console.log("== 9. Orthanc test (real /system, anonymous) ==");
    r = await app("POST", "/api/settings/test", { target: "orthanc" });
    ok(r.json?.ok === true && String(r.json?.message).includes("1.12.5-e2e"),
      `Orthanc test -> ${JSON.stringify(r.json)}`);

    console.log("== 10. OHIF test (HEAD 405 -> GET fallback) ==");
    r = await app("POST", "/api/settings/test", { target: "ohif", network: "lan" });
    ok(r.json?.ok === true && String(r.json?.message).includes("GET ok"),
      `OHIF test -> ${JSON.stringify(r.json)}`);

    console.log("== 11. worklist sync end-to-end (CARE + Orthanc two-step) ==");
    r = await app("POST", "/api/worklist/sync");
    ok(r.json?.ok === true && r.json?.careOk === true, `sync careOk -> ${r.json?.careOk}`);
    ok(r.json?.orthancOk === true, `sync orthancOk -> ${r.json?.orthancOk}`);
    ok(r.json?.lastError === null, `sync lastError -> ${JSON.stringify(r.json?.lastError)}`);

    r = await app("GET", "/api/worklist");
    const worklist = JSON.stringify(r.json ?? {});
    ok(worklist.includes("E2E Patient"), "CARE order imported into the studio worklist");
    ok(worklist.includes("TO_REPORT"), "order promoted to TO_REPORT (images matched via Orthanc)");
  } finally {
    child.kill("SIGTERM");
    for (const s of servers) s.close();
  }

  console.log(process.exitCode ? "\nE2E: FAILURES ABOVE" : "\nE2E: ALL CHECKS PASSED");
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
