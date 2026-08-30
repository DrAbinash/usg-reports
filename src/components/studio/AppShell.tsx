"use client";
/** App shell: slim header + left nav + main region. Single-screen studio. */
import { useStudio } from "@/lib/store";
import { WorklistView } from "./WorklistView";
import { ReportingView } from "./ReportingView";
import { LibraryView } from "./LibraryView";
import { SettingsView } from "./SettingsView";
import { UsgStudioView } from "./usg/UsgStudioView";
import { Stethoscope, ListChecks, BookLock, Settings2, LogOut, RefreshCw, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/store";

const NAV: { id: View; label: string; icon: typeof ListChecks; tint: string }[] = [
  { id: "worklist", label: "Worklist", icon: ListChecks, tint: "text-violet-600 bg-violet-50 ring-violet-200" },
  { id: "usg", label: "USG Studio", icon: Waves, tint: "text-rose-700 bg-rose-50 ring-rose-200" },
  { id: "library", label: "Library", icon: BookLock, tint: "text-teal-700 bg-teal-50 ring-teal-200" },
  { id: "settings", label: "Settings", icon: Settings2, tint: "text-amber-700 bg-amber-50 ring-amber-200" },
];

export function AppShell() {
  const { view, setView, activeOrderId, orders, syncedAt, careOk, orthancOk, syncing, lastError } = useStudio();
  const router = useRouter();

  const toReport = orders.filter((o) => (o.status === "TO_REPORT" || o.status === "REPORTING") && !o.ignored).length;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Studio locked");
    router.refresh();
    window.location.reload();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header — gradient identity strip */}
      <header className="relative flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400" aria-hidden />
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,#7c3aed 0%,#d946ef 55%,#06b6d4 130%)" }}
          >
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight">CARE Reporting Studio</div>
            <div className="text-[10px] text-faint">Single-radiologist workspace</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin text-primary")} />
            {syncedAt
              ? `Synced ${new Date(syncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Not synced yet"}
            <span className={cn("h-1.5 w-1.5 rounded-full", careOk ? "bg-ok" : "bg-faint")} title="CARE ERP" />
            <span className={cn("h-1.5 w-1.5 rounded-full", orthancOk ? "bg-ok" : "bg-faint")} title="Orthanc" />
          </div>
          <button
            onClick={logout}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </header>
      {lastError && !lastError.includes("Demo mode") ? (
        <div className="shrink-0 bg-warn-bg px-4 py-1.5 text-[11px] font-medium text-warn ring-1 ring-warn-line">
          {lastError}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Left nav */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-panel py-3 md:w-44 md:items-stretch md:px-2.5">
          {NAV.map((n) => {
            const active = view === n.id || (n.id === "worklist" && view === "reporting");
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  "relative flex h-10 items-center justify-center gap-2.5 rounded-lg text-[13px] font-medium transition-all md:justify-start md:px-3",
                  active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-md md:h-7 md:w-7", active ? `ring-1 ${n.tint}` : "")}>
                  <n.icon className="h-4 w-4 shrink-0" />
                </span>
                <span className="hidden md:inline">{n.label}</span>
                {n.id === "worklist" && toReport > 0 ? (
                  <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-1 text-[9px] font-bold text-white shadow md:static md:ml-auto">
                    {toReport}
                  </span>
                ) : null}
                {active ? <span className="absolute left-0 top-1/2 hidden h-5 w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-violet-600 to-fuchsia-500 md:block" /> : null}
              </button>
            );
          })}
          {view === "reporting" && activeOrderId ? (
            <button
              onClick={() => setView("worklist")}
              className="mt-auto flex h-9 items-center justify-center gap-2 rounded-lg text-[12px] text-faint transition-colors hover:text-foreground md:justify-start md:px-3"
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Back to list</span>
            </button>
          ) : null}
        </nav>

        {/* Main */}
        <main className="studio-scroll min-h-0 flex-1 overflow-y-auto">
          {view === "worklist" && <WorklistView />}
          {view === "reporting" && activeOrderId && <ReportingView />}
          {view === "usg" && <UsgStudioView />}
          {view === "library" && <LibraryView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
