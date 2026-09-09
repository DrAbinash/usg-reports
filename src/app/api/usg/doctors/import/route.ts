import { requireSession } from "@/lib/auth";
import { importDoctorsFromCsv } from "@/lib/usg/doctors";
import { audit } from "@/lib/usg/audit";

/** POST /api/usg/doctors/import — import doctors from a CSV file upload. */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const contentType = req.headers.get("content-type") ?? "";
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    csvText = await file.text();
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    csvText = await req.text();
  } else {
    // Try to read as raw text
    csvText = await req.text();
  }

  if (!csvText.trim()) {
    return Response.json({ error: "CSV file is empty" }, { status: 400 });
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
