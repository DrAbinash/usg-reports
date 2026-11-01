#!/usr/bin/env node
/**
 * usg-signature-drift.mjs — READ ONLY.
 *
 * "Did the page I signed say what I had on screen?"
 *
 * Until 2026-11-01 the draft-save route stored the findings and impression a
 * save derived, but not the composer state they were derived from
 * (`stateJson`). Finalize builds the signed page from `stateJson`. So any report
 * edited AFTER its first save could be signed from the earlier selections: the
 * impression the register shows says one thing, the printed sheet says another.
 * That is fixed in e4f1ee8, and every new signature now keeps both in step —
 * but the reports already in the database are what they are, and the clinic
 * needs to know how many of them disagree with themselves.
 *
 * This answers that, without touching anything:
 *   - reads each FINALIZED report;
 *   - lifts the impression block back out of its frozen page (`reportHtml`),
 *     which is the document that was printed;
 *   - compares it with the `impression` column, which is what the register,
 *     search and the follow-up diff show today;
 *   - counts the two kinds of mismatch, and writes the per-report detail to a
 *     local file.
 *
 * Nothing about a patient is printed to stdout: the numbers are for the report
 * about the system, the file is for the doctor. `tmp/` is not committed.
 *
 * Run it against whatever database DATABASE_URL points at:
 *
 *   DATABASE_URL=file:/volume1/docker/usg-reporting-studio/data/db/studio.db \
 *     node scripts/usg-signature-drift.mjs
 *
 * Or inside the container, from inside it:
 *
 *   docker compose exec -T usg-reporting-studio node scripts/usg-signature-drift.mjs
 *
 * Exit code is 0 even when drift is found — this is a census, not a gate. It
 * never writes: no update, no delete, no prune.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const OUT = "tmp/signature-drift.tsv";

/** Collapse the printed page's impression block back to comparable text. */
export function extractPrintedImpression(html) {
  const marker = 'class="impression-box"';
  const at = String(html ?? "").indexOf(marker);
  if (at < 0) return null;
  // Start inside the opening tag, then walk with a div-depth counter: the block
  // holds nested divs (premium template) or an <ol> (classic), and a lazy regex
  // stops at the first </div> and silently returns half a sentence.
  let i = html.lastIndexOf("<div", at);
  if (i < 0) return null;
  let depth = 0;
  let end = -1;
  for (let p = i; p < html.length; ) {
    const next = html.indexOf("<", p);
    if (next < 0) break;
    const close = html.startsWith("</div", next);
    const open = html.startsWith("<div", next);
    if (close) {
      const gt = html.indexOf(">", next);
      depth--;
      p = gt + 1;
      if (depth === 0) { end = next; break; }
    } else if (open) {
      const gt = html.indexOf(">", next);
      const selfClose = html[gt - 1] === "/";
      if (!selfClose) depth++;
      p = gt + 1;
    } else {
      p = next + 1;
    }
  }
  if (end < 0) return null;
  const inner = html.slice(i, end);
  const text = inner
    .replace(/<[^>]*>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // The block's own heading ("IMPRESSION") is not part of the text.
  const lines = text.filter((l) => !/^impression:?$/i.test(l));
  return lines.join("\n");
}

/** Same words, however the page and the column each chose to write them. */
export function normalizeImpression(text) {
  return String(text ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[•▪\-]\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function classify(row) {
  const printed = extractPrintedImpression(row.reportHtml);
  const column = normalizeImpression(row.impression);
  if (printed === null) {
    // No impression block at all. Nothing to print and nothing in the register
    // agrees; something in the register with nothing on the page is the case a
    // doctor would want to look at, so it is reported separately from drift.
    return { kind: column ? "no-impression-on-page" : "agree" };
  }
  const a = normalizeImpression(printed);
  if (!a && !column) return { kind: "agree" };
  if (a === column) return { kind: "agree" };
  if (!a) return { kind: "no-impression-on-page" };
  return { kind: "drift" };
}

export async function audit(db) {
  // Deliberately no lastSignedAt here: the census is most useful against a
  // database that predates the amendment columns, and naming a column that does
  // not exist yet would throw before a single report is counted.
  const rows = await db.usgReport.findMany({
    where: { status: "FINALIZED", reportHtml: { not: null } },
    select: { id: true, serialNo: true, patientName: true, impression: true, reportHtml: true, finalizedAt: true, scanDate: true, createdAt: true },
    orderBy: { serialNo: "asc" },
  });
  const counts = { checked: rows.length, agree: 0, drift: 0, "no-impression-on-page": 0 };
  const findings = [];
  for (const r of rows) {
    const c = classify(r);
    counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    if (c.kind === "drift" || c.kind === "no-impression-on-page") {
      findings.push({
        kind: c.kind,
        serialNo: r.serialNo,
        scanDate: (r.scanDate ?? r.finalizedAt ?? r.createdAt)?.toISOString?.().slice(0, 10) ?? "",
        patientName: r.patientName,
        printed: extractPrintedImpression(r.reportHtml) ?? "",
        registerShows: r.impression,
      });
    }
  }
  return { counts, findings };
}

const tsv = (rows) =>
  ["kind\tserialNo\tscanDate\tpatientName\tprintedOnThePage\tregisterShowsToday"].concat(
    rows.map((f) => [f.kind, f.serialNo ?? "", f.scanDate, f.patientName, String(f.printed).replace(/\t|\n/g, " "), String(f.registerShows).replace(/\t|\n/g, " ")].join("\t")),
  ).join("\n");

// Run only when invoked directly (`node scripts/...`), not when the tests import
// these functions. pathToFileURL because on Windows process.argv[1] is
// `C:\Users\…` and a hand-built `file://` + that is never the module's own URL —
// which is how the first version of this script printed nothing at all.
/**
 * Prisma's SQLite path is resolved against the process's working directory, not
 * the schema file, so a relative DATABASE_URL that works for `prisma` commands
 * opens a different — usually empty, sometimes brand-new — database here. That
 * answers "0 signed reports" about a clinic with hundreds, which is the one
 * answer that must never be wrong. Say what to check instead.
 */
export function explainFailure(e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/does not exist in the current database/.test(msg)) {
    return "no USG tables in the database it opened — DATABASE_URL must be an absolute file: path (file:/volume1/docker/usg-reporting-studio/data/db/studio.db), and run this from the studio's own directory";
  }
  return msg.split("\n").filter(Boolean).pop() ?? "unknown error";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new PrismaClient();
  let report;
  try {
    report = await audit(db);
  } catch (e) {
    console.log(`could not read the signed reports: ${explainFailure(e)}`);
    await db.$disconnect();
    process.exit(0);
  }
  const { counts, findings } = report;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${tsv(findings)}\n`, "utf8");
  // lastSignedAt only exists once the amendment schema is pushed. Asked for
  // against an older database it throws, which would hide the counts above — the
  // one number the doctor wants most. So it is optional, and said so.
  let sinceSigned = "unknown (the studio database has no lastSignedAt column yet — deploy first)";
  try {
    sinceSigned = String(await db.usgReport.count({ where: { status: "FINALIZED", lastSignedAt: { not: null } } }));
  } catch {
    // left as the sentence above
  }
  console.log(`signed reports read     ${counts.checked}`);
  console.log(`page agrees with record ${counts.agree}`);
  console.log(`page disagrees          ${counts.drift}`);
  console.log(`nothing printed for it  ${counts["no-impression-on-page"]}`);
  console.log(`signed since the fix    ${sinceSigned}`);
  console.log(`detail (contains patient names, keep it local): ${OUT}`);
  await db.$disconnect();
}
