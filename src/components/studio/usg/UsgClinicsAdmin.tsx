"use client";
/**
 * UsgClinicsAdmin (v6.10) — Clinics admin page for the Settings → Clinics tab.
 *
 * Lists all clinics with their trial status, lets the doctor create new
 * clinics (for trial onboarding), edit branding, set trial expiry, and
 * disable a clinic. The "default" clinic cannot be disabled.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Building2, Loader2, Plus, RefreshCw, AlertTriangle, CheckCircle2, Ban, Pencil,
} from "lucide-react";
import type { Clinic } from "@/lib/clinic";

type ClinicWithFlag = Clinic & { trialExpired: boolean };

function fmtDate(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsgClinicsAdmin() {
  const [clinics, setClinics] = useState<ClinicWithFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // New-clinic form state
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#e11d48");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clinics");
      if (res.ok) {
        const d = (await res.json()) as { clinics: ClinicWithFlag[] };
        setClinics(d.clinics);
      }
    } catch (err) {
      toast.error(`Load failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createClinic = async () => {
    if (!newSlug.trim() || !newName.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim(), name: newName.trim(), brandColor: newColor }),
      });
      if (res.ok) {
        toast.success(`Clinic '${newName}' created`);
        setNewSlug("");
        setNewName("");
        setNewColor("#e11d48");
        await load();
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? `Create failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Create failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleDisabled = async (c: ClinicWithFlag) => {
    if (c.id === "default") {
      toast.error("The default clinic cannot be disabled");
      return;
    }
    try {
      const res = await fetch("/api/clinics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, disabled: !c.disabled }),
      });
      if (res.ok) {
        toast.success(c.disabled ? "Clinic re-enabled" : "Clinic disabled");
        await load();
      } else {
        toast.error(`Update failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Update failed — ${(err as Error)?.message ?? "network error"}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-rose-600" />
        <h3 className="text-sm font-bold">Clinics</h3>
        <span className="text-[10px] text-muted-foreground">
          One installation can host multiple trial centers. Switch via the header dropdown.
        </span>
        <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-[10px]" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-1 h-3 w-3", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Existing clinics list */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading clinics…
        </div>
      ) : (
        <div className="space-y-2">
          {clinics.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-panel p-3">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.brandColor || "#e11d48" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-bold">{c.name}</span>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono">{c.slug}</Badge>
                    {c.id === "default" ? (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-emerald-700">default</Badge>
                    ) : null}
                    {c.disabled ? (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-amber-700">disabled</Badge>
                    ) : null}
                    {c.trialExpired ? (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-red-700">
                        <AlertTriangle className="mr-0.5 h-2.5 w-2.5" /> trial expired
                      </Badge>
                    ) : null}
                  </div>
                  {c.contactName || c.contactPhone || c.contactEmail ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-faint">
                    Trial expires: {fmtDate(c.trialExpiresAt)} · Created {fmtDate(c.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setEditing(editing === c.id ? null : c.id)} title="Edit">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {c.id !== "default" ? (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => toggleDisabled(c)}
                      title={c.disabled ? "Re-enable" : "Disable"}
                    >
                      {c.disabled ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                    </Button>
                  ) : null}
                </div>
              </div>
              {editing === c.id ? (
                <EditClinicForm clinic={c} onSaved={() => { setEditing(null); void load(); }} onCancelled={() => setEditing(null)} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* New clinic form */}
      <div className="rounded-lg border-2 border-dashed border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-1 text-xs font-bold text-rose-700">
          <Plus className="h-3.5 w-3.5" /> Onboard a new trial clinic
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Slug (URL)</Label>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="care-mumbai"
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Clinic name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="CARE Diagnostics Mumbai"
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Brand color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-12 rounded border border-border" />
              <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        <Button onClick={createClinic} disabled={creating} className="mt-2 w-full bg-rose-600 hover:bg-rose-700">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create clinic
        </Button>
      </div>
    </div>
  );
}

function EditClinicForm({ clinic, onSaved, onCancelled }: { clinic: ClinicWithFlag; onSaved: () => void; onCancelled: () => void }) {
  const [name, setName] = useState(clinic.name);
  const [brandColor, setBrandColor] = useState(clinic.brandColor || "#e11d48");
  const [trialExpiresAt, setTrialExpiresAt] = useState(
    clinic.trialExpiresAt ? new Date(clinic.trialExpiresAt).toISOString().slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/clinics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clinic.id,
          name,
          brandColor,
          trialExpiresAt: trialExpiresAt || null,
        }),
      });
      if (res.ok) {
        toast.success("Clinic updated");
        onSaved();
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? `Save failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Save failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-white p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs" />
        </div>
        <div>
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Brand color</Label>
          <div className="flex items-center gap-1">
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-7 w-10 rounded border border-border" />
            <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Trial expires</Label>
          <Input type="date" value={trialExpiresAt} onChange={(e) => setTrialExpiresAt(e.target.value)} className="text-xs" />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={onCancelled} disabled={saving}>Cancel</Button>
        <Button size="sm" className="h-7 text-[10px]" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
