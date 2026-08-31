"use client";
/** App shell: slim header + left nav + main region. Single-screen USG studio. */
import { useStudio } from "@/lib/store";
import { SettingsView } from "./SettingsView";
import { UsgStudioView } from "./usg/UsgStudioView";
import { Waves, Settings2, LogOut, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { View } from "@/lib/store";

const NAV: { id: View; label: string; icon: typeof Waves; tint: string }[] = [
  { id: "usg", label: "USG Studio", icon: Waves, tint: "text-rose-700 bg-rose-50 ring-rose-200" },
  { id: "settings", label: "Settings", icon: Settings2, tint: "text-amber-700 bg-amber-50 ring-amber-200" },
];

export function AppShell() {
  const { view, setView } = useStudio();
  const router = useRouter();

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
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500" aria-hidden />
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: "linear-gradient(135deg,#e11d48 0%,#d946ef 55%,#8b5cf6 130%)" }}
          >
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight">CARE USG Studio</div>
            <div className="text-[10px] text-faint">Sonography reporting</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={logout}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left nav */}
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-panel py-3 md:w-44 md:items-stretch md:px-2.5">
          {NAV.map((n) => {
            const active = view === n.id;
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
                {active ? <span className="absolute left-0 top-1/2 hidden h-5 w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-rose-500 to-fuchsia-500 md:block" /> : null}
              </button>
            );
          })}
        </nav>

        {/* Main */}
        <main className="studio-scroll min-h-0 flex-1 overflow-y-auto">
          {view === "usg" && <UsgStudioView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
