import { requireSession } from "@/lib/auth";
import {
  importDoctorsFromCsv,
  doctorCsvRowCount,
  MAX_DOCTOR_CSV_BYTES,
  MAX_DOCTOR_CSV_ROWS,
} from "@/lib/usg/doctors";
import { audit } from "@/lib/usg/audit";

function tooBig(bytes: number): Response {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  const limit = (MAX_DOCTOR_CSV_BYTES / (1024 * 1024)).toFixed(0);
  return Response.json(
    { error: `That file is ${mb} MB. The doctor import takes files up to ${limit} MB.` },
    { status: 413 },
  );
}

/**
 * Read the body as text, giving up the moment it passes the ceiling — a
 * chunked request with no Content-Length is otherwise buffered whole.
 */
async function readCappedText(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOCTOR_CSV_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * POST /api/usg/doctors/import — import doctors from a CSV file upload.
 *
 * Bounded on purpose. This endpoint reads the whole upload into a string and the
 * importer then runs one upsert per row, so picking the wrong file — an
 * export of every bill, not the referring-doctor list — used to be an
 * out-of-memory request on a container capped at 512 MB and a write lock the
 * reporting clinic has to wait out.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_DOCTOR_CSV_BYTES) return tooBig(declared);

  const contentType = req.headers.get("content-type") ?? "";
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_DOCTOR_CSV_BYTES) return tooBig(file.size);
    csvText = await file.text();
  } else {
    const read = await readCappedText(req);
    if (read === null) return tooBig(MAX_DOCTOR_CSV_BYTES + 1);
    csvText = read;
  }

  if (!csvText.trim()) {
    return Response.json({ error: "CSV file is empty" }, { status: 400 });
  }

  const rows = doctorCsvRowCount(csvText);
  if (rows > MAX_DOCTOR_CSV_ROWS) {
    return Response.json(
      {
        error: `That file has ${rows.toLocaleString("en-IN")} rows. The import takes ${MAX_DOCTOR_CSV_ROWS.toLocaleString("en-IN")} at a time — split a longer list into files of that size.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await importDoctorsFromCsv(csvText);
    await audit({
      action: "doctors.import",
      detail: `Imported ${result.imported} doctors from CSV (${result.skipped} skipped of ${result.total})`,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
