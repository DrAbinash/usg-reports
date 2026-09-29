"use client";
/** App shell: brand + top nav + optional composer patient strip (no left sidebar). */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStudio } from "@/lib/store";
import { SettingsView } from "./SettingsView";
import { UsgStudioView } from "./usg/UsgStudioView";
import { UsgInsightsView } from "./usg/UsgInsightsView";
import { UsgWorklistView } from "./usg/UsgWorklistView";
import { UsgDarkModeToggle } from "./usg/UsgDarkModeToggle";
import { UsgCommandPalette } from "./usg/UsgCommandPalette";
import { UsgClinicSwitcher } from "./usg/UsgClinicSwitcher";
import { UsgClinicLink } from "./usg/UsgClinicLink";
import { UsgQueuePicker } from "./usg/UsgQueuePicker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDY_GROUPS, USG_STUDIES } from "@/lib/usg/studies";
import { OnboardingLayer } from "./usg/OnboardingLayer";
import { UsgBirthdayGreeting, BirthdayHeaderButton, birthdayDismissed, rememberBirthdayDismissed, useBirthdayFlag } from "./usg/UsgBirthdayGreeting";
import { Waves, Settings2, LogOut, Stethoscope, BarChart3, ClipboardList, ExternalLink, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/store";
import { clinicDisplayName, studioProductTitle } from "@/lib/usg/branding";

const NAV: { id: View; label: string; icon: typeof Waves }[] = [
  { id: "worklist", label: "Worklist", icon: ClipboardList },
  { id: "usg", label: "USG Studio", icon: Waves },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

/** Opens the LAN OHIF worklist — useful when no study is open in the composer. */
const PACS_OHIF_URL = "http://172.16.1.139:3010/viewer";

export function AppShell() {
  const {
    view,
    setView,
    composerStrip,
    composerBack,
    expandPatientForm,
    composerPickStudy,
    activeReportId,
  } = useStudio();
  const router = useRouter();
  const queryClient = useQueryClient();
  const composing = !!composerStrip;

  const { data: branding } = useQuery({
    queryKey: ["settings", "branding"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("settings");
      const d = await res.json();
      return (d?.settings ?? d ?? {}) as { hospitalName?: string; appTitle?: string };
    },
    staleTime: 60_000,
  });
  const brandTitle = studioProductTitle(branding ?? {});
  const brandClinic = clinicDisplayName(branding ?? {});

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["usg", "patients"],
      queryFn: async () => {
        const res = await fetch("/api/usg/patients");
        if (!res.ok) throw new Error("patients");
        return ((await res.json()).patients ?? []) as unknown[];
      },
    });
    void queryClient.prefetchQuery({
      queryKey: ["usg", "pathologies"],
      queryFn: async () => {
        const pRes = await fetch("/api/usg/pathologies");
        if (!pRes.ok) throw new Error("pathologies");
        return ((await pRes.json()).pathologies ?? []) as unknown[];
      },
      staleTime: 5 * 60_000,
    });
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    void queryClient.prefetchQuery({
      queryKey: ["usg", "worklist", todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/usg/worklist?from=${todayStr}&to=${todayStr}`);
        if (!res.ok) throw new Error("worklist");
        return res.json();
      },
      staleTime: 30_000,
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
      <header className="relative flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-2.5">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500" aria-hidden />
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,#e11d48 0%,#d946ef 55%,#8b5cf6 130%)" }}
          >
            <Stethoscope className="h-3.5 w-3.5" />
          </div>
          {!composing ? (
            <div className="leading-tight">
              <div className="max-w-[14rem] truncate text-[12px] font-bold tracking-tight" title={brandTitle}>
                {brandTitle}
              </div>
              <div className="hidden max-w-[14rem] truncate text-[9px] text-faint sm:block" title={brandClinic}>
                {brandClinic !== brandTitle ? brandClinic : "Sonography reporting"}
              </div>
            </div>
          ) : null}
        </div>

        {/* While composing: patient strip + queue jump (patient/study selects) */}
        {composing && composerStrip ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => composerBack?.()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => expandPatientForm?.()}
              className="flex min-w-0 max-w-[18rem] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-rose-50 xl:max-w-[22rem]"
              title="Click to edit patient details"
            >
              <span className="truncate text-[12px] font-bold text-foreground">
                {composerStrip.patientName || "New report"}
              </span>
              {composerStrip.patientAge ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">{composerStrip.patientAge}y</span>
              ) : null}
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {composerStrip.patientSex === "C" ? "Child" : composerStrip.patientSex}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  composerStrip.status === "final" ? "bg-amber-100 text-amber-800" : "bg-amber-50 text-amber-700",
                )}
              >
                {composerStrip.status === "final" ? "final" : "draft"}
              </span>
            </button>
            <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
            {/* Format override, surfaced in the header: when the bill has no
                matching USG format the doctor must change it, and until now the
                only picker sat inside the collapsed demography form. */}
            {composerPickStudy ? (
              <Select
                value={composerStrip.studyKey}
                onValueChange={(k) => composerPickStudy(k)}
                disabled={composerStrip.status === "final"}
              >
                <SelectTrigger
                  data-testid="header-study-picker"
                  aria-label="Report format"
                  className={cn(
                    "h-7 w-auto min-w-[9.5rem] max-w-[15rem] gap-1 rounded-md border-rose-300 bg-white px-2 text-[11.5px] font-bold text-rose-900 shadow-sm hover:border-rose-400",
                    !composerStrip.studyKey && "border-dashed text-rose-700",
                  )}
                >
                  <SelectValue placeholder="Choose a format" />
                </SelectTrigger>
                <SelectContent className="max-h-96 overflow-y-auto">
                  {STUDY_GROUPS.map((g) => {
                    const items = USG_STUDIES.filter((s) => s.group === g.key);
                    if (!items.length) return null;
                    return (
                      <SelectGroup key={g.key}>
                        <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          {g.label}
                        </SelectLabel>
                        {items.map((s) => (
                          <SelectItem key={s.key} value={s.key} className="text-[12px]">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                  {USG_STUDIES.filter((s) => !s.group || !STUDY_GROUPS.some((g) => g.key === s.group)).map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-[12px]">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <UsgQueuePicker
              compact
              className="hidden min-w-0 flex-1 sm:flex"
              currentReportId={activeReportId}
            />
          </div>
        ) : (
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
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {composing ? (
            <nav className="mr-1 hidden items-center gap-0.5 md:flex" aria-label="Primary">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setView(n.id)}
                  title={n.label}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    view === n.id ? "bg-rose-100 text-rose-700" : "text-slate-500 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <n.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </nav>
          ) : null}
          {!composing ? <UsgClinicSwitcher /> : null}
          {!composing ? <UsgClinicLink /> : null}
          {bday?.today ? <BirthdayHeaderButton onClick={() => setBdayCard(true)} /> : null}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true }));
            }}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open command palette (Ctrl+K)"
          >
            <kbd className="font-mono text-[10px] font-bold">⌘K</kbd>
          </button>
          <UsgDarkModeToggle />
          <button
            onClick={logout}
            className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </header>

      <main className="studio-scroll min-h-0 flex-1 overflow-y-auto">
        {/* Keep worklist + studio mounted so open/back is instant (CARE workspace pattern). */}
        <div className={cn("h-full", view === "worklist" ? "block" : "hidden")} aria-hidden={view !== "worklist"}>
          <UsgWorklistView />
        </div>
        <div className={cn("h-full", view === "usg" ? "block" : "hidden")} aria-hidden={view !== "usg"}>
          <UsgStudioView />
        </div>
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
