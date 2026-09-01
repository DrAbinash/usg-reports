#!/usr/bin/env node
/**
 * QA mock — a miniature CARE ERP (internal-reporting-studio contract) and
 * Orthanc, serving the EXACT verified production row shape (Sital Jaiswal:
 * blank accession, worklistId 4831, StudyInstanceUID) plus control rows.
 *
 *   CARE     http://localhost:8899  (x-api-key: qa-key)
 *   Orthanc  http://localhost:8442
 *
 * Rows served:
 *   4831  US   Sital Jaiswal   accession ""  uid 1.2.276...2166193  billing null
 *   4832  US   Awaiting Images accession ""  uid ""  (no study in PACS yet)
 *   4833  US   Legacy Acc      accession "CARE-24103" uid ""
 *   4834  CT   CT Patient      (must be excluded from the USG studio)
 *   4835  US   No Identity     accession "" uid "" worklistId "" (skipped + reason)
 * Orthanc studies:
 *   1.2.276.0.26.1.1.1.2.2026.280.41706.2166193  (Sital's study, accession "")
 *   1.2.276.0.26.1.1.1.2.2026.280.41707.113    accession "CARE-24103" (legacy link)
 */
import { createServer } from "node:http";

const API_KEY = "qa-key";

const WORKLIST = [
  {
    worklistId: "4831", accessionNumber: "", patientName: "Sital Jaiswal", patientId: 8127,
    modality: "US", studyDate: "2026-09-01T00:00:00.000Z",
    studyInstanceUid: "1.2.276.0.26.1.1.1.2.2026.280.41706.2166193",
    patientAge: "26/F", referringDoctor: "Dr. Kumar", testName: "USG PREGNANCY 3RD TRIMESTER",
    billingStatus: null, patientPhone: "9800000000", patientAddress: "Deoghar", billNumber: "",
  },
  {
    worklistId: "4832", accessionNumber: "", patientName: "Awaiting Images", patientId: 8128,
    modality: "US", studyDate: "2026-09-01T00:00:00.000Z", studyInstanceUid: "",
    patientAge: "30/F", billingStatus: null,
  },
  {
    worklistId: "4833", accessionNumber: "CARE-24103", patientName: "Legacy Acc", patientId: 8129,
    modality: "USG", studyDate: "2026-09-01T00:00:00.000Z", studyInstanceUid: "",
    patientAge: "44/M", referringDoctor: "Dr. Sen", testName: "USG WHOLE ABDOMEN", billingStatus: "DUE",
  },
  { worklistId: "4834", accessionNumber: "CT-9001", patientName: "CT Patient", modality: "CT", studyDate: "2026-09-01T00:00:00.000Z" },
  { worklistId: "", accessionNumber: "", patientName: "No Identity", modality: "US", studyDate: "2026-09-01T00:00:00.000Z" },
];

const STUDIES = {
  "st-1": { ID: "st-1", MainDicomTags: { StudyInstanceUID: "1.2.276.0.26.1.1.1.2.2026.280.41706.2166193", AccessionNumber: "", StudyDate: "20260901" } },
  "st-2": { ID: "st-2", MainDicomTags: { StudyInstanceUID: "1.2.276.0.26.1.1.1.2.2026.280.41707.113", AccessionNumber: "CARE-24103", StudyDate: "20260901" } },
};

const care = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.headers["x-api-key"] !== API_KEY) return json(401, { error: "bad key" });
  if (url.pathname === "/api/internal/reporting-studio/ping") return json(200, { ok: true, version: "qa" });
  if (url.pathname === "/api/internal/reporting-studio/worklist") return json(200, WORKLIST);
  if (url.pathname === "/api/internal/reporting-studio/billing-status") return json(200, {});
  if (url.pathname === "/api/internal/reporting-studio/finalize" && req.method === "POST") return json(200, { ok: true });
  json(404, { error: "no route" });
});

const pacs = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/studies") return json(200, Object.keys(STUDIES));
  const m = url.pathname.match(/^\/studies\/([^/]+)$/);
  if (m && STUDIES[m[1]]) return json(200, STUDIES[m[1]]);
  if (url.pathname === "/system") return json(200, { Name: "qa", Version: "1.12.0" });
  json(404, {});
});

care.listen(8899, () => console.log("CARE mock :8899 (x-api-key qa-key)"));
pacs.listen(8442, () => console.log("Orthanc mock :8442"));
