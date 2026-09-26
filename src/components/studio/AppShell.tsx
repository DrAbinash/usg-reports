"use client";
/** App shell: brand + top nav ribbon + main region (no left sidebar). */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStudio } from "@/lib/store";
import { SettingsView } from "./SettingsView";
import { UsgStudioView } from "./usg/UsgStudioView";
import { UsgInsightsView } from "./usg/UsgInsightsView";
import { UsgWorklistView } from "./usg/UsgWorklistView";
import { UsgDarkModeToggle } from "./usg/UsgDarkModeToggle";
import { UsgCommandPalette } from "./usg/UsgCommandPalette";
import { UsgClinicSwitcher } from "./usg/UsgClinicSwitcher";
import { UsgClinicLink } from "./usg/UsgClinicLink";
import { OnboardingLayer } from "./usg/OnboardingLayer";
import { UsgBirthdayGreeting, BirthdayHeaderButton, birthdayDismissed, rememberBirthdayDismissed, useBirthdayFlag } from "./usg/UsgBirthdayGreeting";
import { Waves, Settings2, LogOut, Stethoscope, BarChart3, ClipboardList, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/store";

const NAV: { id: View; label: string; icon: typeof Waves }[] = [
  { id: "worklist", label: "Worklist", icon: ClipboardList },
  { id: "usg", label: "USG Studio", icon: Waves },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

/** Opens the LAN OHIF worklist — useful when no study is open in the composer.
 *  Per-study viewing already lives in the embedded DICOM pane. */
const PACS_OHIF_URL = "http://172.16.1.139:3010/viewer";

export function AppShell() {
  const { view, setView } = useStudio();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["usg", "patients"],
      queryFn: async () => {
        const res = await fetch("/api/usg/patients");
        if (!res.ok) throw new Error("patients");
        return ((await res.json()).patients ?? []) as unknown[];
      },
    });
  }, [queryClient]);

  const bday = useBirthdayFlag();
  const [bdayCard, setBdayCard] = useState(false);
  useEffect(() => {
    if (!bday?.today) return;
    const year = new Date().getFullYear();
    if (!birthdayDismissed(year)) setBdayCard(true);
  }, [bday]);
  const closeBirthdayCard = () => {
    rememberBirthdayDismissed(new Date().getFullYear());
    setBdayCard(false);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Studio locked");
    router.refresh();
    window.location.reload();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Brand + primary nav in one top ribbon */}
      <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500" aria-hidden />
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,#e11d48 0%,#d946ef 55%,#8b5cf6 130%)" }}
          >
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight">CARE USG Studio</div>
            <div className="hidden text-[10px] text-faint sm:block">Sonography reporting</div>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" aria-label="Primary">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setView(n.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold transition-colors",
                  active
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-rose-50 hover:text-rose-800",
                )}
              >
                <n.icon className="h-3.5 w-3.5" />
                <span>{n.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => window.open(PACS_OHIF_URL, "_blank", "noopener,noreferrer")}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold text-indigo-800 hover:bg-indigo-50"
            title="Open full OHIF / PACS in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>PACS</span>
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <UsgClinicSwitcher />
          <UsgClinicLink />
          {bday?.today ? <BirthdayHeaderButton onClick={() => setBdayCard(true)} /> : null}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }));
            }}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open command palette (Ctrl+K)"
          >
            <kbd className="font-mono text-[10px] font-bold">⌘K</kbd>
          </button>
          <UsgDarkModeToggle />
          <button
            onClick={logout}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </header>

      <main className="studio-scroll min-h-0 flex-1 overflow-y-auto">
        {view === "worklist" && <UsgWorklistView />}
        {view === "usg" && <UsgStudioView />}
        {view === "insights" && <UsgInsightsView />}
        {view === "settings" && <SettingsView />}
      </main>

      <OnboardingLayer />

      {bday?.today ? (
        <UsgBirthdayGreeting message={bday?.message ?? ""} open={bdayCard} onClose={closeBirthdayCard} name={bday.name} birthday={bday.birthday} />
      ) : null}

      <UsgCommandPalette />
    </div>
  );
}
