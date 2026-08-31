"use client";
/** Settings — Appearance / Hospital / USG Studio / Security. Secrets masked. */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionLabel } from "./bits";
import { LOGIN_THEMES, type LoginThemeName } from "./LockScreen";
import { Building2, ShieldCheck, Check, Palette, Upload, Trash2, Waves, Download, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Settings = {
  appTitle: string; hospitalName: string; addressLine: string; phone: string; email: string;
  footerMessage: string; logoUrl: string;
  loginTheme: string; loginBgUrl: string;
  pinSet: boolean;
  usgDoctorName: string; usgDoctorQual: string; usgDoctorRegNo: string;
  usgMachineLine: string; usgShowMachine: boolean;
  usgFooterLine: string; usgDeclarationLine: string;
  usgPrintStyle: string; usgPrintCompact: boolean;
  usgPrintPaper: string; usgSignatureUrl: string;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [pin, setPin] = useState({ current: "", next: "" });
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setS(d.settings);
    });
  }, []);

  if (!s) return <div className="p-6 text-[13px] text-faint">Loading settings…</div>;

  const set = (k: keyof Settings, v: string) => setS({ ...s, [k]: v } as Settings);

  const save = async () => {
    const body: Record<string, string> = { ...s } as unknown as Record<string, string>;
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => res.json());
    if (r.settings) {
      toast.success("Settings saved");
    } else {
      toast.error("Could not save settings");
    }
  };

  /** Restore a studio personalisation backup — settings + custom findings. */
  const restoreBackup = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/usg/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Restore failed");
      toast.success(`Backup restored — ${body.settingsRestored ?? 0} settings, ${body.customPathologiesRestored ?? 0} custom findings`);
      // Reload settings so the restored values show immediately.
      const fresh = await fetch("/api/settings").then((r) => r.json());
      if (fresh.settings) {
        setS(fresh.settings);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
      if (restoreFileRef.current) restoreFileRef.current.value = "";
    }
  };

  const changePin = async () => {
    const r = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pin),
    }).then((res) => res.json());
    if (r.ok) {
      toast.success("PIN changed");
      setPin({ current: "", next: "" });
    } else toast.error(r.error);
  };

  /** Downscale the picked photo to ≤1920px wide JPEG data-URL, then save. */
  const uploadBg = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Pick an image file (JPG/PNG)"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image too large — pick one under 8 MB"); return; }
    setBgUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const maxW = 1920;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
        img.src = url;
      });
      setS((prev) => (prev ? { ...prev, loginBgUrl: dataUrl } : prev));
      // Save immediately — the background is meant to be quick to try.
      const body: Record<string, string> = { ...(s as unknown as Record<string, string>), loginBgUrl: dataUrl };
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      if (r.settings) toast.success("Login background saved — lock the studio to see it");
      else toast.error("Could not save background");
    } catch {
      toast.error("Could not process that image");
    } finally {
      setBgUploading(false);
      if (bgFileRef.current) bgFileRef.current.value = "";
    }
  };

  const removeBg = async () => {
    setS((prev) => (prev ? { ...prev, loginBgUrl: "" } : prev));
    const body: Record<string, string> = { ...(s as unknown as Record<string, string>), loginBgUrl: "" };
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    toast.success("Background removed — gradient theme shows instead");
  };

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <SectionLabel>Settings</SectionLabel>
      <h1 className="mb-5 mt-1 text-lg font-bold tracking-tight">Studio configuration</h1>

      <Tabs defaultValue="appearance">
        <TabsList className="bg-panel">
          <TabsTrigger value="appearance" className="text-[12px]"><Palette className="mr-1.5 h-3.5 w-3.5" />Appearance</TabsTrigger>
          <TabsTrigger value="hospital" className="text-[12px]"><Building2 className="mr-1.5 h-3.5 w-3.5" />Hospital</TabsTrigger>
          <TabsTrigger value="usg" className="text-[12px]"><Waves className="mr-1.5 h-3.5 w-3.5" />USG Studio</TabsTrigger>
          <TabsTrigger value="security" className="text-[12px]"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-4 space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <p className="text-[13px] font-bold">Login screen theme</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">
              Six colour identities for the login screen — the gradient, the keypad glow and the PIN dots all follow it.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {(Object.keys(LOGIN_THEMES) as LoginThemeName[]).map((name) => {
                const t = LOGIN_THEMES[name];
                const Icon = t.icon;
                const active = (s.loginTheme || "aurora") === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { set("loginTheme", name); }}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition-all active:scale-[0.97]",
                      active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow" style={{ background: t.accent }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-[12px] font-bold">{t.label}</span>
                      {active ? <Check className="ml-auto h-3.5 w-3.5 text-primary" /> : null}
                    </div>
                    <div className="mt-2.5 flex gap-1">
                      {t.blobs.map((c) => (
                        <span key={c} className="h-2.5 flex-1 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <p className="text-[13px] font-bold">Login background photo</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">
              Upload any photo of your centre — it fills the login screen behind the card with a colour wash on top so the keypad stays readable. Landscape photos look best. Leave empty to keep the pure gradient.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                style={s.loginBgUrl ? { backgroundImage: `url(${s.loginBgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                {!s.loginBgUrl ? (
                  <div className="flex h-full w-full items-center justify-center" style={{ background: LOGIN_THEMES[(s.loginTheme || "aurora") as LoginThemeName]?.accent ?? LOGIN_THEMES.aurora.accent }}>
                    <span className="text-[10px] font-bold text-white/90">GRADIENT</span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBg(f); }} />
                <Button size="sm" variant="outline" className="h-8 w-fit border-border text-[11.5px]" disabled={bgUploading} onClick={() => bgFileRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />{bgUploading ? "Processing…" : s.loginBgUrl ? "Replace photo" : "Upload photo"}
                </Button>
                {s.loginBgUrl ? (
                  <Button size="sm" variant="ghost" className="h-8 w-fit text-[11.5px] text-destructive hover:bg-bad-bg" onClick={removeBg}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <Button onClick={save} className="h-9 text-[12.5px]">Save appearance</Button>
        </TabsContent>

        <TabsContent value="hospital" className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5">
          <Field label="App title"><Input value={s.appTitle} onChange={(e) => set("appTitle", e.target.value)} className="h-9 text-[13px]" /></Field>
          <Field label="Hospital name"><Input value={s.hospitalName} onChange={(e) => set("hospitalName", e.target.value)} className="h-9 text-[13px]" /></Field>
          <Field label="Address"><Input value={s.addressLine} onChange={(e) => set("addressLine", e.target.value)} className="h-9 text-[13px]" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone"><Input value={s.phone} onChange={(e) => set("phone", e.target.value)} className="h-9 text-[13px]" /></Field>
            <Field label="Email"><Input value={s.email} onChange={(e) => set("email", e.target.value)} className="h-9 text-[13px]" /></Field>
          </div>
          <Field label="Logo URL" hint="Shown top-left on the printed report letterhead.">
            <Input value={s.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" className="h-9 text-[13px]" />
          </Field>
          <Field label="Footer message"><Input value={s.footerMessage} onChange={(e) => set("footerMessage", e.target.value)} className="h-9 text-[13px]" /></Field>
          <Button onClick={save} className="h-9 text-[12.5px]">Save</Button>
        </TabsContent>

        <TabsContent value="usg" className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200">
            <Waves className="h-4 w-4" /> Sonologist block printed on every USG report
          </div>
          <Field label="Sonologist name" hint="e.g. Dr. Sugandha Priyadarshini">
            <Input value={s.usgDoctorName ?? ""} onChange={(e) => set("usgDoctorName", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Qualification" hint="e.g. MBBS, MD">
            <Input value={s.usgDoctorQual ?? ""} onChange={(e) => set("usgDoctorQual", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Registration number">
            <Input value={s.usgDoctorRegNo ?? ""} onChange={(e) => set("usgDoctorRegNo", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Machine banner" hint="Printed in italics under the study heading — the doctor's classic line.">
            <Input value={s.usgMachineLine ?? ""} onChange={(e) => set("usgMachineLine", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Report footer line" hint="Printed at the bottom of every USG report.">
            <Input value={s.usgFooterLine ?? ""} onChange={(e) => set("usgFooterLine", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Declaration (optional)" hint="Boxed legal line under the signature, e.g. the PC-PNDT declaration. Leave blank to omit.">
            <Textarea value={s.usgDeclarationLine ?? ""} onChange={(e) => set("usgDeclarationLine", e.target.value)} rows={2} className="text-[12px]" />
          </Field>
          <Field label="Print style" hint="Premium = gradient letterhead with banded sections. Classic = plain black-and-white serif letterhead — traditional look, saves ink and prints fast.">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintStyle: "premium" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  (s.usgPrintStyle ?? "premium") !== "classic"
                    ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                    : "border-border bg-panel text-muted-foreground hover:border-rose-200",
                )}
              >
                Premium
                <span className="block text-[10px] font-normal text-faint">Gradient masthead · banded sections</span>
              </button>
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintStyle: "classic" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  s.usgPrintStyle === "classic"
                    ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                    : "border-border bg-panel text-muted-foreground hover:border-rose-200",
                )}
              >
                Classic
                <span className="block text-[10px] font-normal text-faint">Plain B/W serif · ink saver</span>
              </button>
            </div>
          </Field>
          <Field label="Paper size" hint="A4 = full sheet. A5 = half-sheet — the whole report scales down for A5 stock; ideal for short studies and quick prints.">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintPaper: "a4" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  (s.usgPrintPaper ?? "a4") !== "a5"
                    ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                    : "border-border bg-panel text-muted-foreground hover:border-rose-200",
                )}
              >
                A4
                <span className="block text-[10px] font-normal text-faint">Full sheet · 210 × 297 mm</span>
              </button>
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintPaper: "a5" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  s.usgPrintPaper === "a5"
                    ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                    : "border-border bg-panel text-muted-foreground hover:border-rose-200",
                )}
              >
                A5
                <span className="block text-[10px] font-normal text-faint">Half sheet · 148 × 210 mm</span>
              </button>
            </div>
          </Field>
          <Field label="Scanned signature (optional)" hint="Image URL (or data-URL) of the doctor's scanned signature — printed over the name line instead of the empty rule. Scan the signature on white paper, crop tightly.">
            <Input value={s.usgSignatureUrl ?? ""} onChange={(e) => set("usgSignatureUrl", e.target.value)} placeholder="https://… or data:image/png;base64,…" className="h-9 text-[13px]" />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={s.usgShowMachine !== false}
              onChange={(e) => setS({ ...s, usgShowMachine: e.target.checked } as Settings)}
              className="h-4 w-4 accent-rose-600"
            />
            Show the machine banner on printed USG reports
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={s.usgPrintCompact === true}
              onChange={(e) => setS({ ...s, usgPrintCompact: e.target.checked } as Settings)}
              className="h-4 w-4 accent-rose-600"
            />
            Compact print density (smaller type — long studies like echo fit one page)
          </label>

          {/* Backup & restore — the whole studio personalisation as one JSON file */}
          <div className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
            <div className="flex items-center gap-2 text-[12px] font-bold text-rose-800">
              <ArchiveRestore className="h-4 w-4" /> Backup &amp; restore
            </div>
            <p className="text-[11px] leading-relaxed text-rose-700/90">
              One JSON file carries everything that makes the studio personal — letterhead &amp; identity settings,
              print preferences and every custom quick-select finding you added. Patient reports and the PIN
              never travel in a backup. Restore on any machine and the studio is yours again.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/usg/backup" download>
                <Button size="sm" variant="outline" className="h-8 border-rose-200 bg-white text-[11.5px] text-rose-700 hover:bg-rose-100">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download backup (.json)
                </Button>
              </a>
              <input
                ref={restoreFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restoreBackup(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-rose-200 bg-white text-[11.5px] text-rose-700 hover:bg-rose-100"
                disabled={restoring}
                onClick={() => restoreFileRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> {restoring ? "Restoring…" : "Restore from file"}
              </Button>
            </div>
          </div>

          <Button onClick={save} className="h-9 text-[12.5px]">Save</Button>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className={cn("h-4 w-4", s.pinSet ? "text-ok" : "text-warn")} />
            <p className="text-[12.5px] font-medium">{s.pinSet ? "PIN is active" : "No PIN set"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Current PIN"><Input type="password" inputMode="numeric" maxLength={6} value={pin.current} onChange={(e) => setPin({ ...pin, current: e.target.value })} className="h-9 font-mono text-[13px]" /></Field>
            <Field label="New PIN"><Input type="password" inputMode="numeric" maxLength={6} value={pin.next} onChange={(e) => setPin({ ...pin, next: e.target.value })} className="h-9 font-mono text-[13px]" /></Field>
          </div>
          <Button onClick={changePin} disabled={pin.current.length !== 6 || pin.next.length !== 6} className="h-9 text-[12.5px]">Change PIN</Button>
          <p className="text-[11px] leading-relaxed text-faint">
            Sessions last 12 hours, or 30 days when you tick “Trust this device”. No usernames, no reset email —
            the studio is yours alone.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
