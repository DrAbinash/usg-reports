"use client";
/** Settings — Appearance / Hospital / USG Studio / Security / Data & activity. Secrets masked. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionLabel } from "./bits";
import { LOGIN_THEMES, type LoginThemeName } from "./LockScreen";
import { Building2, ShieldCheck, Check, Palette, Upload, Trash2, Waves, Download, ArchiveRestore, Database, History, RefreshCw, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { auditLabel } from "@/lib/usg/auditShared";

type Settings = {
  appTitle: string; hospitalName: string; addressLine: string; phone: string; email: string;
  footerMessage: string; logoUrl: string;
  loginTheme: string; loginBgUrl: string;
  pinSet: boolean;
  usgDoctorName: string; usgDoctorQual: string; usgDoctorRegNo: string;
  usgDoctorBirthday: string;
  usgMachineLine: string; usgShowMachine: boolean;
  usgFooterLine: string; usgDeclarationLine: string;
  usgPrintStyle: string; usgPrintCompact: boolean;
  usgPrintPaper: string; usgSignatureUrl: string;
  usgPrintFontSize: number; usgPrintLineHeight: number;
  usgPrintSpacing: string; usgPrintShowTechnique: boolean; usgPrintShowThanks: boolean;
  usgSidebarPosition?: string; usgLogoPosition?: string; usgAddressPosition?: string; usgPrintFontFamily?: string;
  usgAutoBackup: boolean;
  // v6 integrations (secrets arrive masked — only their presence flags)
  careApiBase: string; careApiKeySet: boolean;
  orthancUrl: string; orthancUsername: string; orthancPasswordSet: boolean;
  geminiApiKeySet: boolean;
  pcpndtCentreName: string; pcpndtRegistrationNo: string; pcpndtPlace: string;
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

/**
 * Read an image file into a downscaled PNG data-URL — the letter-pad logo
 * and scanned signature upload path (no hosting, works offline on the LAN).
 * Longest edge is capped so a phone photo never bloats the settings row.
 */
function imageFileToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [pin, setPin] = useState({ current: "", next: "" });
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  // Data & activity tab
  const [auditEntries, setAuditEntries] = useState<{
    id: string; action: string; serialNo: number | null; patientName: string | null;
    detail: string; createdAt: string;
  }[]>([]);
  const [backupStatus, setBackupStatus] = useState<{
    autoBackup: boolean; lastNightlyAt: string | null;
    files: { name: string; bytes: number; modifiedAt: string }[];
  } | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // v6.2 letter-pad logo + scanned signature upload (file → PNG data-URL).
  // Refs live with the other hooks — BEFORE the loading early-return.
  const logoFileRef = useRef<HTMLInputElement>(null);
  const sigFileRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState<"" | "logo" | "sig">("");

  // v6 — integrations tab: secret inputs (write-only) + connection test lights
  const [careKey, setCareKey] = useState("");
  const [orthancPass, setOrthancPass] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [testing, setTesting] = useState<"" | "care" | "orthanc">("");
  const [testResult, setTestResult] = useState<{ care?: { ok: boolean; version?: string; error?: string }; orthanc?: { ok: boolean; version?: string; error?: string } } | null>(null);

  const testConnections = async (which: "all" | "care" | "orthanc") => {
    setTesting(which === "all" ? "" : which);
    const r = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ which }),
    })
      .then((res) => res.json())
      .catch(() => null);
    setTesting("");
    if (!r) {
      toast.error("Test failed");
      return;
    }
    setTestResult(r);
    if (which !== "orthanc" && r.care) {
      if (r.care.ok) toast.success(`CARE connected (v${r.care.version ?? "?"})`);
      else toast.error(r.care.error ?? "CARE unreachable");
    }
    if (which !== "care" && r.orthanc) {
      if (r.orthanc.ok) toast.success(`Orthanc connected (v${r.orthanc.version ?? "?"})`);
      else toast.error(r.orthanc.error ?? "Orthanc unreachable");
    }
  };

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/usg/audit?limit=150");
    if (res.ok) setAuditEntries(((await res.json()).entries ?? []) as typeof auditEntries);
  }, []);

  const loadBackupStatus = useCallback(async () => {
    const res = await fetch("/api/usg/backup?mode=status");
    if (res.ok) setBackupStatus(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setS(d.settings);
    });
  }, []);

  const loadAuditRef = useRef(loadAudit);
  const loadBackupStatusRef = useRef(loadBackupStatus);
  useEffect(() => {
    void loadAuditRef.current();
    void loadBackupStatusRef.current();
  }, []);

  if (!s) return <div className="p-6 text-[13px] text-faint">Loading settings…</div>;

  const set = (k: keyof Settings, v: string) => setS({ ...s, [k]: v } as Settings);

  const save = async () => {
    const body: Record<string, string> = { ...s } as unknown as Record<string, string>;
    // v6 secrets: only send non-empty write-only inputs ("" means keep).
    if (careKey.trim()) body.careApiKey = careKey.trim();
    if (orthancPass.trim()) body.orthancPassword = orthancPass.trim();
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => res.json());
    if (r.settings) {
      toast.success("Settings saved");
      setS(r.settings);
      setCareKey("");
      setOrthancPass("");
      setGeminiKey("");
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
      toast.success(`Backup restored — ${body.mode === "full" ? `${body.reportsRestored ?? 0} reports, ${body.patientsRestored ?? 0} patients, ${body.imagesRestored ?? 0} stills` : `${body.settingsRestored ?? 0} settings, ${body.customPathologiesRestored ?? 0} custom findings`}`);
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

  // ── v6.2 letter-pad logo + scanned signature uploads (file → PNG data-URL).
  // Saves immediately through the same whitelist as the Save button so a
  // freshly uploaded logo shows on the very next print.
  const uploadPrintImage = async (which: "logo" | "sig", file: File) => {
    setImageBusy(which);
    try {
      const dataUrl = await imageFileToDataUrl(file, which === "logo" ? 512 : 900);
      const key = which === "logo" ? "logoUrl" : "usgSignatureUrl";
      setS((prev) => (prev ? { ...prev, [key]: dataUrl } : prev));
      const body: Record<string, string> = { ...(s as unknown as Record<string, string>), [key]: dataUrl };
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      if (r.settings) toast.success(which === "logo" ? "Letter-pad logo saved — it prints on the next report" : "Signature saved — it prints over the name line");
      else toast.error("Could not save image");
    } catch {
      toast.error("Could not process that image (PNG / JPG / WebP)");
    } finally {
      setImageBusy("");
      if (which === "logo" && logoFileRef.current) logoFileRef.current.value = "";
      if (which === "sig" && sigFileRef.current) sigFileRef.current.value = "";
    }
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
          <TabsTrigger value="integrations" className="text-[12px]"><Link2 className="mr-1.5 h-3.5 w-3.5" />Integrations</TabsTrigger>
          <TabsTrigger value="security" className="text-[12px]"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="data" className="text-[12px]"><Database className="mr-1.5 h-3.5 w-3.5" />Data &amp; activity</TabsTrigger>
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
          <Field label="Letter-pad logo" hint="Printed top-left on every report letterhead. Upload the clinic's logo file (PNG / JPG / WebP) — it is stored inside the studio, no hosting needed — or paste a URL.">
            <div className="flex items-center gap-2">
              <Input value={s.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://… or upload →" className="h-9 text-[13px]" />
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPrintImage("logo", f); }}
              />
              <Button size="sm" variant="outline" className="h-9 shrink-0 border-border text-[11.5px]" disabled={imageBusy === "logo"} onClick={() => logoFileRef.current?.click()}>
                {imageBusy === "logo" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
              {s.logoUrl.startsWith("data:image") ? (
                <img src={s.logoUrl} alt="logo preview" className="h-9 w-9 shrink-0 rounded-md border border-border bg-white object-contain p-0.5" />
              ) : null}
            </div>
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
          <Field label="Sonologist's birthday" hint='Month and day (MM-DD) — the studio opens with a small birthday card on this date each year, and the greeting is remembered for the day. e.g. 09-01. Clear it to turn the greeting off.'>
            <Input value={s.usgDoctorBirthday ?? ""} onChange={(e) => set("usgDoctorBirthday", e.target.value)} placeholder="MM-DD" className="h-9 w-32 text-[13px]" inputMode="numeric" />
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
          <Field label="Print style" hint="Premium = gradient masthead with banded sections. Classic = plain B/W serif. Premium Sidebar = two-column layout with images in a sidebar (like the reference clinic format).">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintStyle: "premium" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  (s.usgPrintStyle ?? "premium") === "premium"
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
              <button
                type="button"
                onClick={() => setS({ ...s, usgPrintStyle: "premium_sidebar" } as Settings)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                  s.usgPrintStyle === "premium_sidebar"
                    ? "border-violet-300 bg-violet-50 text-violet-800 ring-1 ring-violet-200"
                    : "border-border bg-panel text-muted-foreground hover:border-violet-200",
                )}
              >
                Premium Sidebar
                <span className="block text-[10px] font-normal text-faint">Two-column · image sidebar</span>
              </button>
            </div>
          </Field>

          {/* v6.7 — Sidebar layout configuration */}
          {s.usgPrintStyle === "premium_sidebar" && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase text-violet-700">Sidebar Layout</p>
              <Field label="Image sidebar position" hint="Where the image sidebar appears on the printed report.">
                <div className="flex gap-2">
                  <button type="button" onClick={() => set("usgSidebarPosition", "right")}
                    className={cn("rounded border px-3 py-1.5 text-[11px] font-semibold",
                      (s.usgSidebarPosition ?? "right") === "right" ? "border-violet-400 bg-violet-100 text-violet-800" : "border-border bg-panel text-muted-foreground")}>
                    Right (default)
                  </button>
                  <button type="button" onClick={() => set("usgSidebarPosition", "left")}
                    className={cn("rounded border px-3 py-1.5 text-[11px] font-semibold",
                      s.usgSidebarPosition === "left" ? "border-violet-400 bg-violet-100 text-violet-800" : "border-border bg-panel text-muted-foreground")}>
                    Left
                  </button>
                </div>
              </Field>
              <Field label="Logo position" hint="Where the hospital logo appears in the top bar.">
                <div className="flex gap-2">
                  {(["left", "right", "center"] as const).map((pos) => (
                    <button key={pos} type="button" onClick={() => set("usgLogoPosition", pos)}
                      className={cn("rounded border px-3 py-1.5 text-[11px] font-semibold capitalize",
                        (s.usgLogoPosition ?? "left") === pos ? "border-violet-400 bg-violet-100 text-violet-800" : "border-border bg-panel text-muted-foreground")}>
                      {pos}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Address / contact position" hint="Where the clinic contact info appears in the top bar.">
                <div className="flex gap-2">
                  {(["right", "left", "center"] as const).map((pos) => (
                    <button key={pos} type="button" onClick={() => set("usgAddressPosition", pos)}
                      className={cn("rounded border px-3 py-1.5 text-[11px] font-semibold capitalize",
                        (s.usgAddressPosition ?? "right") === pos ? "border-violet-400 bg-violet-100 text-violet-800" : "border-border bg-panel text-muted-foreground")}>
                      {pos}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Font family" hint="Body text font for the sidebar format.">
                <div className="flex gap-2">
                  {(["sans-serif", "serif", "system"] as const).map((fam) => (
                    <button key={fam} type="button" onClick={() => set("usgPrintFontFamily", fam)}
                      className={cn("rounded border px-3 py-1.5 text-[11px] font-semibold",
                        (s.usgPrintFontFamily ?? "sans-serif") === fam ? "border-violet-400 bg-violet-100 text-violet-800" : "border-border bg-panel text-muted-foreground")}
                      style={{ fontFamily: fam === "serif" ? "serif" : fam === "system" ? "system-ui" : "sans-serif" }}>
                      {fam === "sans-serif" ? "Sans" : fam === "serif" ? "Serif" : "System"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
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

          {/* v6.2 — Print layout fine-tuning: dials that size the letterhead to the clinic's paper */}
          <div className="space-y-3.5 rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
            <div className="flex items-center gap-2 text-[12px] font-bold text-rose-800">
              <Waves className="h-4 w-4" /> Print layout — fine-tuning
            </div>
            <p className="text-[11px] leading-relaxed text-rose-700/90">
              Dial the printed report to the clinic's paper and printer. The signature, declaration and
              footer always move to a second page as one block — a lone signature never spills — and
              <b> tight</b> spacing plus a smaller font keeps a typical study on a single sheet.
              Changes apply from the next Print / PDF.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label={`Font size — ${(s.usgPrintFontSize ?? 10).toFixed(1)} pt`}>
                <input
                  type="range"
                  min={8.5}
                  max={13}
                  step={0.5}
                  value={s.usgPrintFontSize ?? 10}
                  onChange={(e) => setS({ ...s, usgPrintFontSize: Number(e.target.value) } as Settings)}
                  className="h-2 w-full cursor-pointer accent-rose-600"
                />
                <div className="flex justify-between text-[10px] text-faint"><span>8.5 small</span><span>13 large</span></div>
              </Field>
              <Field label={`Gaps between lines — ${(s.usgPrintLineHeight ?? 1.4).toFixed(2)}×`}>
                <input
                  type="range"
                  min={1.15}
                  max={1.9}
                  step={0.05}
                  value={s.usgPrintLineHeight ?? 1.4}
                  onChange={(e) => setS({ ...s, usgPrintLineHeight: Number(e.target.value) } as Settings)}
                  className="h-2 w-full cursor-pointer accent-rose-600"
                />
                <div className="flex justify-between text-[10px] text-faint"><span>1.15 tight</span><span>1.9 airy</span></div>
              </Field>
            </div>

            <Field label="Section spacing" hint="Vertical gaps between the heading bands and finding rows.">
              <div className="flex gap-2">
                {([
                  ["tight", "Tight", "best for one page"],
                  ["normal", "Normal", "balanced default"],
                  ["relaxed", "Relaxed", "airy, long reports"],
                ] as const).map(([value, label, sub]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setS({ ...s, usgPrintSpacing: value } as Settings)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                      (s.usgPrintSpacing ?? "tight") === value
                        ? "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200"
                        : "border-border bg-panel text-muted-foreground hover:border-rose-200",
                    )}
                  >
                    {label}
                    <span className="block text-[10px] font-normal text-faint">{sub}</span>
                  </button>
                ))}
              </div>
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={s.usgPrintShowTechnique !== false}
                onChange={(e) => setS({ ...s, usgPrintShowTechnique: e.target.checked } as Settings)}
                className="h-4 w-4 accent-rose-600"
              />
              Print the Technique row on reports (off = Findings starts directly)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={s.usgPrintShowThanks !== false}
                onChange={(e) => setS({ ...s, usgPrintShowThanks: e.target.checked } as Settings)}
                className="h-4 w-4 accent-rose-600"
              />
              Print the "Thanks For Your Referral." tagline under the patient strip
            </label>
          </div>

          <Field label="Scanned signature (optional)" hint="Printed over the name line instead of the empty rule. Upload the scanned signature (white paper, cropped tight) or paste an image URL / data-URL.">
            <div className="flex items-center gap-2">
              <Input value={s.usgSignatureUrl ?? ""} onChange={(e) => set("usgSignatureUrl", e.target.value)} placeholder="https://… or upload →" className="h-9 text-[13px]" />
              <input
                ref={sigFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPrintImage("sig", f); }}
              />
              <Button size="sm" variant="outline" className="h-9 shrink-0 border-border text-[11.5px]" disabled={imageBusy === "sig"} onClick={() => sigFileRef.current?.click()}>
                {imageBusy === "sig" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
              {(s.usgSignatureUrl ?? "").startsWith("data:image") ? (
                <img src={s.usgSignatureUrl} alt="signature preview" className="h-9 w-16 shrink-0 rounded-md border border-border bg-white object-contain p-0.5" />
              ) : null}
            </div>
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

        <TabsContent value="integrations" className="mt-4 space-y-6 rounded-xl border border-border bg-card p-5">
          {/* CARE ERP bridge */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sky-600" />
              <h3 className="text-[13px] font-bold">CARE ERP — bill-desk worklist</h3>
              {s.careApiKeySet ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">key set</span>
              ) : null}
            </div>
            <Field
              label="ERP base URL"
              hint="Scheme + host + port, WITHOUT /api — the studio appends /api/internal/reporting-studio/… (e.g. http://172.16.1.139:8888)"
            >
              <Input value={s.careApiBase} onChange={(e) => set("careApiBase", e.target.value)} placeholder="http://172.16.1.139:8888"
                className="h-9 border-border bg-panel text-[12.5px] font-mono" />
            </Field>
            <Field label="API key" hint="The same static key the ERP holds in REPORTING_STUDIO_API_KEY. Write-only — a saved key shows as a green badge, never its value.">
              <Input value={careKey} onChange={(e) => setCareKey(e.target.value)} placeholder={s.careApiKeySet ? "saved — type to replace" : "openssl rand -hex 24 style key"}
                type="password" className="h-9 border-border bg-panel text-[12.5px] font-mono" />
            </Field>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => void testConnections("care")} disabled={testing !== ""}>
                {testing === "care" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Test CARE
              </Button>
              {testResult?.care ? (
                <span className={cn("text-[11.5px] font-semibold", testResult.care.ok ? "text-emerald-700" : "text-red-600")}>
                  {testResult.care.ok ? `connected${testResult.care.version ? ` · v${testResult.care.version}` : ""}` : testResult.care.error}
                </span>
              ) : null}
            </div>
          </section>

          {/* Orthanc PACS */}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-violet-600" />
              <h3 className="text-[13px] font-bold">Orthanc PACS — machine images &amp; SR</h3>
            </div>
            <Field label="Orthanc URL" hint="The PACS the USG machine pushes to (e.g. http://172.16.1.139:8042). Leave the username blank when Orthanc has no auth.">
              <Input value={s.orthancUrl} onChange={(e) => set("orthancUrl", e.target.value)} placeholder="http://172.16.1.139:8042"
                className="h-9 border-border bg-panel text-[12.5px] font-mono" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username">
                <Input value={s.orthancUsername} onChange={(e) => set("orthancUsername", e.target.value)} placeholder="anonymous"
                  className="h-9 border-border bg-panel text-[12.5px]" />
              </Field>
              <Field label="Password" hint={s.orthancPasswordSet ? "saved — type to replace" : "blank when Orthanc is open on the LAN"}>
                <Input value={orthancPass} onChange={(e) => setOrthancPass(e.target.value)} type="password"
                  placeholder={s.orthancPasswordSet ? "saved — type to replace" : ""}
                  className="h-9 border-border bg-panel text-[12.5px]" />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={() => void testConnections("orthanc")} disabled={testing !== ""}>
                {testing === "orthanc" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Test Orthanc
              </Button>
              {testResult?.orthanc ? (
                <span className={cn("text-[11.5px] font-semibold", testResult.orthanc.ok ? "text-emerald-700" : "text-red-600")}>
                  {testResult.orthanc.ok ? `connected${testResult.orthanc.version ? ` · v${testResult.orthanc.version}` : ""}` : testResult.orthanc.error}
                </span>
              ) : null}
            </div>
          </section>

          {/* Optional Vision OCR */}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-fuchsia-600" />
              <h3 className="text-[13px] font-bold">Vision OCR — optional</h3>
              {s.geminiApiKeySet ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">key set</span>
              ) : null}
            </div>
            <Field
              label="Gemini API key"
              hint="Used ONLY when a machine stores no DICOM SR: the burned-in biometry is read from the images (the ERP's approach). Without a key the studio stays SR-only — everything else keeps working."
            >
              <Input value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} type="password"
                placeholder={s.geminiApiKeySet ? "saved — type to replace" : "optional"}
                className="h-9 border-border bg-panel text-[12.5px] font-mono" />
            </Field>
          </section>

          {/* PC-PNDT Form F fixed details */}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-600" />
              <h3 className="text-[13px] font-bold">PC-PNDT Form F — fixed details</h3>
            </div>
            <Field label="Centre name &amp; address" hint="Pre-filled on every Form F (field 1). Two lines are fine.">
              <Textarea value={s.pcpndtCentreName} onChange={(e) => set("pcpndtCentreName", e.target.value)} rows={2}
                className="border-border bg-panel text-[12.5px]" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PC-PNDT registration no." hint="Field 2 on the form.">
                <Input value={s.pcpndtRegistrationNo} onChange={(e) => set("pcpndtRegistrationNo", e.target.value)}
                  className="h-9 border-border bg-panel text-[12.5px]" />
              </Field>
              <Field label="Place" hint="Printed beside the date.">
                <Input value={s.pcpndtPlace} onChange={(e) => set("pcpndtPlace", e.target.value)}
                  className="h-9 border-border bg-panel text-[12.5px]" />
              </Field>
            </div>
            <p className="text-[11px] leading-relaxed text-faint">
              The conducting doctor and registration number come from the USG Studio tab (signature block) — the same values print on reports and Form F.
            </p>
          </section>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={() => void save()} className="h-9 gap-2 text-[13px]">
              <Check className="h-4 w-4" /> Save settings
            </Button>
          </div>
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

        <TabsContent value="data" className="mt-4 space-y-5 rounded-xl border border-border bg-card p-5">
          {/* Full-clinic backup */}
          <div className="space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/40 p-3.5">
            <div className="flex items-center gap-2 text-[12px] font-bold text-sky-800">
              <Database className="h-4 w-4" /> Full-clinic backup
            </div>
            <p className="text-[11px] leading-relaxed text-sky-700/90">
              One JSON file with the whole clinic — settings, custom findings, every patient, every report
              (drafts and frozen snapshots) and the attached stills. This is disaster recovery for the
              single-box install: keep a copy off the machine (email it to yourself, copy to a pen drive).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a href="/api/usg/backup?mode=full" download>
                <Button size="sm" variant="outline" className="h-8 border-sky-200 bg-white text-[11.5px] text-sky-700 hover:bg-sky-100">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download clinic backup (.json)
                </Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-sky-200 bg-white text-[11.5px] text-sky-700 hover:bg-sky-100"
                disabled={restoring}
                onClick={() => restoreFileRef.current?.click()}
                title="Restores whichever backup kind the file carries (auto-detected)"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> {restoring ? "Restoring…" : "Restore clinic backup"}
              </Button>
            </div>
            <p className="text-[10.5px] text-sky-600">
              Restoring is idempotent — reports and patients are matched by id, nothing outside the file is deleted,
              and a register-number clash skips that report rather than renumbering anything.
            </p>
          </div>

          {/* Nightly rotation */}
          <div className="space-y-2.5 rounded-xl border border-border bg-panel p-3.5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-[12px] font-bold">Automatic nightly backup</p>
              <Switch
                checked={backupStatus?.autoBackup ?? false}
                disabled={autoSaving}
                onCheckedChange={async (v) => {
                  setAutoSaving(true);
                  try {
                    const res = await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ usgAutoBackup: v ? "true" : "false" }),
                    });
                    if (res.ok) {
                      toast.success(v ? "Nightly backups enabled" : "Nightly backups off");
                      await loadBackupStatus();
                      const fresh = await fetch("/api/settings").then((r) => r.json());
                      if (fresh.settings) setS(fresh.settings);
                    } else {
                      toast.error("Could not change the nightly backup setting");
                    }
                  } finally {
                    setAutoSaving(false);
                  }
                }}
                className="ml-auto data-[state=checked]:bg-emerald-600"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-faint">
              While the studio is running: once a day after 02:00, a full-clinic backup is written to
              <code className="mx-1 rounded bg-card px-1 py-0.5 text-[10.5px]">data/backups/</code>
              on this machine and the newest 14 are kept. Download the latest file from here whenever you want one off-site.
            </p>
            {backupStatus ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {backupStatus.files.length === 0
                    ? "No backups on disk yet."
                    : `${backupStatus.files.length} backup file${backupStatus.files.length > 1 ? "s" : ""} on disk${
                        backupStatus.lastNightlyAt
                          ? ` — last nightly ${new Date(backupStatus.lastNightlyAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : ""
                      }`}
                </p>
                {backupStatus.files.slice(0, 5).map((f) => (
                  <p key={f.name} className="flex items-center gap-2 text-[10.5px] text-faint">
                    <ArchiveRestore className="h-3 w-3" /> {f.name} · {(f.bytes / 1_000).toFixed(0)} KB
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {/* Activity — the audit trail */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold">Activity</p>
              <span className="text-[10.5px] text-faint">every save, finalization, deletion, backup and login — append-only</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 w-7 p-0 text-muted-foreground"
                onClick={() => {
                  void loadAudit();
                  void loadBackupStatus();
                }}
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            {auditEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-panel px-3 py-4 text-center text-[11.5px] text-faint">
                Nothing recorded yet — the trail starts with your next save.
              </p>
            ) : (
              <div className="studio-scroll max-h-80 overflow-y-auto rounded-lg border border-border">
                {auditEntries.map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5 border-b border-border/60 px-3 py-2 last:border-0">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold",
                        e.action === "report.finalize"
                          ? "bg-emerald-50 text-emerald-700"
                          : e.action === "report.delete" || e.action === "auth.fail"
                            ? "bg-rose-50 text-rose-700"
                            : e.action.startsWith("backup")
                              ? "bg-sky-50 text-sky-700"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {auditLabel(e.action)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {e.patientName || e.serialNo != null ? (
                        <p className="truncate text-[11.5px] font-semibold">
                          {e.patientName}
                          {e.serialNo != null ? ` · USG-${String(e.serialNo).padStart(4, "0")}` : ""}
                        </p>
                      ) : null}
                      {e.detail ? <p className="truncate text-[10.5px] text-muted-foreground">{e.detail}</p> : null}
                    </div>
                    <span className="shrink-0 text-[10px] text-faint">
                      {new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
