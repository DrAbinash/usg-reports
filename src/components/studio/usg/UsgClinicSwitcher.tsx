"use client";
/**
 * UsgClinicSwitcher (v6.10) — header dropdown for multi-clinic installs.
 *
 * Shows the active clinic's name + a chevron. Click to open a dropdown
 * listing all clinics (with trial-expired badges). Click a clinic to
 * switch — sets the cookie via /api/clinics/active and reloads the page
 * so every list view refetches with the new clinicId.
 *
 * On a single-clinic install, the dropdown is hidden (only one option).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Building2, Plus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Clinic } from "@/lib/clinic";

type ClinicWithFlag = Clinic & { trialExpired: boolean };

export function UsgClinicSwitcher() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicWithFlag[]>([]);
  const [active, setActive] = useState<ClinicWithFlag | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/clinics/active");
      if (res.ok) {
        const d = (await res.json()) as { active: ClinicWithFlag | null; clinics: ClinicWithFlag[] };
        setClinics(d.clinics);
        setActive(d.active);
      }
    } catch {
      // silent — the switcher stays usable as a label
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Hide the switcher entirely on a single-clinic install (no clutter).
  if (!loading && clinics.length <= 1) return null;

  const switchTo = async (clinicId: string) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/clinics/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId }),
      });
      if (res.ok) {
        const d = (await res.json()) as { active: ClinicWithFlag };
        setActive(d.active);
        toast.success(`Switched to ${d.active.name}`);
        // Reload the page so every list view refetches with the new clinicId.
        router.refresh();
        setTimeout(() => window.location.reload(), 200);
      } else {
        toast.error(`Switch failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Switch failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
          title="Switch clinic"
          disabled={switching}
        >
          {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5 text-rose-600" />}
          <span className="max-w-[120px] truncate">{active?.name ?? "Clinic"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">
          Switch clinic
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clinics.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => switchTo(c.id)}
            className={cn("flex items-center gap-2", c.id === active?.id && "bg-muted")}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: c.brandColor || "#e11d48" }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[12px] font-semibold">{c.name}</span>
                {c.id === active?.id ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" /> : null}
              </div>
              {c.trialExpired ? (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-600">
                  <AlertTriangle className="h-2.5 w-2.5" /> trial expired
                </span>
              ) : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
