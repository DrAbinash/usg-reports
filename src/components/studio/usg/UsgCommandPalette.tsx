"use client";
/**
 * UsgCommandPalette (v6.9) — global Ctrl/Cmd+K command palette.
 *
 * A fast, keyboard-driven way to:
 *   - Switch to Worklist / USG Studio / Insights / Settings
 *   - Start a new USG report
 *   - Open the patient registry (patients mode in studio)
 *   - Open the USG register export
 *   - Open the audit log
 *   - Toggle dark mode (cycles light → dark → auto)
 *   - Lock the studio
 *
 * Mounted at AppShell level so it's available from any view. The
 * underlying shadcn/ui Command primitive handles keyboard nav (↑↓ Enter
 * Esc) and fuzzy filtering.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Waves, ClipboardList, BarChart3, Settings2, Plus, Users, BookOpen, History,
  Moon, LogOut, FileCheck2,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import type { View } from "@/lib/store";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type CommandDef = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Waves;
  group: "Navigate" | "Reports" | "Studio" | "System";
  action: () => void;
  keywords?: string;
};

export function UsgCommandPalette() {
  const [open, setOpen] = useState(false);
  const { view, setView } = useStudio();
  const router = useRouter();

  // Ctrl+K / Cmd+K toggles. Esc closes (handled by Dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        // Don't trigger while typing in an input/textarea/select — let the
        // browser's native Ctrl+K (or the user's selection) work normally.
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
          // Studio search uses "/" already; Ctrl+K in a text field is the
          // user's job to handle. Skip our global handler.
          return;
        }
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (v: View) => {
    setView(v);
    setOpen(false);
  };

  const logout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Studio locked");
    router.refresh();
    window.location.reload();
  };

  const toggleDark = () => {
    setOpen(false);
    // Cycle the same way UsgDarkModeToggle does.
    const cur = (localStorage.getItem("usg-dark-mode") ?? "light") as "light" | "dark" | "auto";
    const next = cur === "light" ? "dark" : cur === "dark" ? "auto" : "light";
    localStorage.setItem("usg-dark-mode", next);
    document.documentElement.classList.toggle("dark", next === "dark" || (next === "auto" && (new Date().getHours() >= 18 || new Date().getHours() < 6)));
    toast.success(`Theme: ${next}`);
  };

  const newReport = () => {
    go("usg");
    // The studio view's "New Report" button prefill state is internal to
    // UsgStudioView — we land on the studio home and let the doctor click
    // the prominent button. (Wiring a global event-bus for this is a
    // larger refactor than this enhancement warrants.)
    toast.info("New Report — click the rose New Report button on the studio home");
  };

  const openPatients = () => {
    go("usg");
    toast.info("Switch to the Patients tab in the studio home");
  };

  const openRegister = () => {
    go("usg");
    toast.info("Open the Register button on the studio home header");
  };

  const openAudit = () => {
    go("settings");
    toast.info("Audit log is under Settings → Data & activity");
  };

  const commands: CommandDef[] = [
    // Navigate
    { id: "nav-worklist", label: "Go to Worklist", icon: ClipboardList, group: "Navigate", action: () => go("worklist"), keywords: "bill desk care orders" },
    { id: "nav-studio", label: "Go to USG Studio", icon: Waves, group: "Navigate", action: () => go("usg"), keywords: "reports list patients" },
    { id: "nav-insights", label: "Go to Insights", icon: BarChart3, group: "Navigate", action: () => go("insights"), keywords: "analytics stats" },
    { id: "nav-settings", label: "Go to Settings", icon: Settings2, group: "Navigate", action: () => go("settings"), keywords: "config preferences" },
    // Reports
    { id: "rep-new", label: "New USG report", icon: Plus, group: "Reports", action: newReport, keywords: "create start" },
    { id: "rep-patients", label: "Open patient registry", icon: Users, group: "Reports", action: openPatients, keywords: "history search" },
    { id: "rep-register", label: "Open USG register export", icon: BookOpen, group: "Reports", action: openRegister, keywords: "pcpndt csv print" },
    { id: "rep-audit", label: "Open audit log", icon: History, group: "Reports", action: openAudit, keywords: "activity history" },
    // Studio (current view)
    { id: "studio-finalize", label: "Finalize current report (Ctrl+Enter in composer)", icon: FileCheck2, group: "Studio", action: () => { setOpen(false); toast.info("Press Ctrl+Enter in the composer to finalize"); }, keywords: "sign lock" },
    // System
    { id: "sys-dark", label: "Toggle dark mode", icon: Moon, group: "System", action: toggleDark, keywords: "theme night light" },
    { id: "sys-lock", label: "Lock studio", icon: LogOut, group: "System", action: logout, keywords: "logout sign out" },
  ];

  const groups: CommandDef["group"][] = ["Navigate", "Reports", "Studio", "System"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Quick actions and navigation — type to search, ↑↓ to move, Enter to run, Esc to close.
        </DialogDescription>
        <Command className="flex h-[420px] flex-col overflow-hidden">
          <CommandInput placeholder="Type a command or search…" />
          <CommandList className="flex-1 overflow-y-auto">
            <CommandEmpty>No matching command.</CommandEmpty>
            {groups.map((g) => {
              const items = commands.filter((c) => c.group === g);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={g} heading={g}>
                  {items.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.label} ${c.keywords ?? ""}`}
                      onSelect={() => c.action()}
                      className="cursor-pointer"
                    >
                      <c.icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{c.label}</span>
                      {c.hint ? <span className="text-[10px] text-faint">{c.hint}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
            <div className="px-3 py-2 text-[10px] text-faint">
              <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> navigate ·{" "}
              <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd> run ·{" "}
              <kbd className="rounded border bg-muted px-1 font-mono">Esc</kbd> close
            </div>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
