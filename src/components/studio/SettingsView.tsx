"use client";
/** Settings — Hospital / Radiologist / Security / Integrations. Secrets masked. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionLabel } from "./bits";
import { Building2, UserRound, ShieldCheck, PlugZap, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Settings = {
  appTitle: string; hospitalName: string; addressLine: string; phone: string; email: string;
  footerMessage: string; logoUrl: string;
  radiologistName: string; radiologistQual: string; radiologistRegNo: string;
  careApiBase: string; careApiKeySet: boolean;
  orthancUrl: string; orthancUsername: string; orthancPasswordSet: boolean;
  ohifLanUrl: string; ohifTailscaleUrl: string;
  pinSet: boolean;
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

function TestPill({ state }: { state: { ok: boolean; msg: string } | "loading" | undefined }) {
  if (!state) return null;
  if (state === "loading") return <span className="text-[11px] text-faint">Testing…</span>;
  return (
    <span className={cn("flex items-center gap-1 text-[11px] font-medium", state.ok ? "text-ok" : "text-bad")}>
      {state.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {state.msg}
    </span>
  );
}

export function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [careApiKey, setCareApiKey] = useState("");
  const [orthancPassword, setOrthancPassword] = useState("");
  const [tests, setTests] = useState<Record<string, { ok: boolean; msg: string } | "loading">>({});
  const [pin, setPin] = useState({ current: "", next: "" });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings));
  }, []);

  if (!s) return <div className="p-6 text-[13px] text-faint">Loading settings…</div>;

  const set = (k: keyof Settings, v: string) => setS({ ...s, [k]: v } as Settings);

  const save = async () => {
    const body: Record<string, string> = { ...s } as unknown as Record<string, string>;
    body.careApiKey = careApiKey;
    body.orthancPassword = orthancPassword;
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => res.json());
    if (r.settings) {
      setS({ ...s, careApiKeySet: r.settings.careApiKeySet, orthancPasswordSet: r.settings.orthancPasswordSet });
      setCareApiKey("");
      setOrthancPassword("");
      toast.success("Settings saved");
    } else {
      toast.error("Could not save settings");
    }
  };

  const runTest = async (target: string, network?: string) => {
    const key = network ? `${target}:${network}` : target;
    setTests((t) => ({ ...t, [key]: "loading" }));
    const r = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target, network }),
    }).then((res) => res.json());
    setTests((t) => ({ ...t, [key]: { ok: r.ok, msg: r.ok ? r.message : r.error } }));
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

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <SectionLabel>Settings</SectionLabel>
      <h1 className="mb-5 mt-1 text-lg font-bold tracking-tight">Studio configuration</h1>

      <Tabs defaultValue="hospital">
        <TabsList className="bg-panel">
          <TabsTrigger value="hospital" className="text-[12px]"><Building2 className="mr-1.5 h-3.5 w-3.5" />Hospital</TabsTrigger>
          <TabsTrigger value="radiologist" className="text-[12px]"><UserRound className="mr-1.5 h-3.5 w-3.5" />Radiologist</TabsTrigger>
          <TabsTrigger value="security" className="text-[12px]"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="integrations" className="text-[12px]"><PlugZap className="mr-1.5 h-3.5 w-3.5" />Integrations</TabsTrigger>
        </TabsList>

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

        <TabsContent value="radiologist" className="mt-4 space-y-4 rounded-xl border border-border bg-card p-5">
          <Field label="Name"><Input value={s.radiologistName} onChange={(e) => set("radiologistName", e.target.value)} className="h-9 text-[13px]" /></Field>
          <Field label="Qualification" hint="Printed under the signature, e.g. MBBS, MD (Radiodiagnosis).">
            <Input value={s.radiologistQual} onChange={(e) => set("radiologistQual", e.target.value)} className="h-9 text-[13px]" />
          </Field>
          <Field label="Registration number"><Input value={s.radiologistRegNo} onChange={(e) => set("radiologistRegNo", e.target.value)} className="h-9 text-[13px]" /></Field>
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

        <TabsContent value="integrations" className="mt-4 space-y-5">
          {/* CARE */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold">CARE ERP bridge</p>
              <Button size="sm" variant="outline" className="h-8 border-border text-[11.5px]" onClick={() => runTest("care")}>Test connection</Button>
            </div>
            <Field label="API base URL" hint="e.g. https://care.caredeoghar.com — the ERP exposes /api/internal/reporting-studio/*.">
              <Input value={s.careApiBase} onChange={(e) => set("careApiBase", e.target.value)} placeholder="https://…" className="h-9 text-[13px]" />
            </Field>
            <Field label="API key" hint={s.careApiKeySet ? "Key saved — enter a new one to replace it." : "Sent as x-api-key header; stored server-side only."}>
              <div className="flex items-center gap-2">
                <Input type="password" value={careApiKey} onChange={(e) => setCareApiKey(e.target.value)} placeholder={s.careApiKeySet ? "•••••••• (saved)" : "paste key"} className="h-9 font-mono text-[13px]" />
                {s.careApiKeySet ? <span className="flex items-center gap-1 text-[11px] font-medium text-ok"><Check className="h-3 w-3" /> saved</span> : null}
              </div>
            </Field>
            <TestPill state={tests["care"]} />
          </div>

          {/* Orthanc */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold">Orthanc PACS</p>
              <Button size="sm" variant="outline" className="h-8 border-border text-[11.5px]" onClick={() => runTest("orthanc")}>Test connection</Button>
            </div>
            <Field label="Orthanc URL" hint="e.g. http://192.168.1.20:8042 — DICOMweb + /api/studies used for the worklist match.">
              <Input value={s.orthancUrl} onChange={(e) => set("orthancUrl", e.target.value)} placeholder="http://…" className="h-9 text-[13px]" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Username"><Input value={s.orthancUsername} onChange={(e) => set("orthancUsername", e.target.value)} className="h-9 text-[13px]" /></Field>
              <Field label="Password">
                <div className="flex items-center gap-2">
                  <Input type="password" value={orthancPassword} onChange={(e) => setOrthancPassword(e.target.value)} placeholder={s.orthancPasswordSet ? "•••••••• (saved)" : "password"} className="h-9 font-mono text-[13px]" />
                  {s.orthancPasswordSet ? <span className="flex items-center gap-1 text-[11px] font-medium text-ok"><Check className="h-3 w-3" /> saved</span> : null}
                </div>
              </Field>
            </div>
            <TestPill state={tests["orthanc"]} />
          </div>

          {/* OHIF */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-[13px] font-bold">OHIF viewer</p>
            <div className="grid gap-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="LAN URL" hint="In-hospital address, e.g. http://192.168.1.20:3001">
                    <Input value={s.ohifLanUrl} onChange={(e) => set("ohifLanUrl", e.target.value)} placeholder="http://…" className="h-9 text-[13px]" />
                  </Field>
                </div>
                <Button size="sm" variant="outline" className="h-9 border-border text-[11.5px]" onClick={() => runTest("ohif", "lan")}>Test</Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Tailscale URL" hint="Outside-hospital address via your Tailnet">
                    <Input value={s.ohifTailscaleUrl} onChange={(e) => set("ohifTailscaleUrl", e.target.value)} placeholder="http://…" className="h-9 text-[13px]" />
                  </Field>
                </div>
                <Button size="sm" variant="outline" className="h-9 border-border text-[11.5px]" onClick={() => runTest("ohif", "tailscale")}>Test</Button>
              </div>
            </div>
            <TestPill state={tests["ohif:lan"]} />
            <TestPill state={tests["ohif:tailscale"]} />
          </div>

          <Button onClick={save} className="h-9 text-[12.5px]">Save integrations</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
