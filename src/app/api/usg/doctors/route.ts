import { requireSession } from "@/lib/auth";
import { searchDoctors, saveDoctor, listDoctors } from "@/lib/usg/doctors";

/** GET /api/usg/doctors?q=xxx — search doctors for autocomplete, or list all. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q) {
    const doctors = await searchDoctors(q);
    return Response.json({ doctors });
  }
  const doctors = await listDoctors();
  return Response.json({ doctors });
}

/** POST /api/usg/doctors — add or update a single doctor. */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  try {
    const doctor = await saveDoctor({
      id: "",
      name: String(body.name ?? ""),
      specialization: String(body.specialization ?? ""),
      degree: String(body.degree ?? ""),
      phone: String(body.phone ?? ""),
      hospital: String(body.hospital ?? ""),
      area: String(body.area ?? ""),
    });
    return Response.json({ doctor });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
