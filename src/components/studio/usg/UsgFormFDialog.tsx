"use client";
/**
 * UsgFormFDialog — PC-PNDT Form F for one order/report.
 *
 * The CARE ERP flow, distilled: fixed clinic details arrive pre-filled from
 * Settings; demographics arrive from the bill-desk order; GA + the objective
 * result lift from the composer; the doctor verifies the ID card, completes
 * the statutory fields, saves and prints the A4 sheet.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Printer, Save, FileCheck2, BadgeCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  applyComposerToFormF,
  buildFormFPrintHtml,
  defaultFormF,
  evaluateFormFCompleteness,
  prefillFormFFromOrder,
  type UsgFormFData,
} from "@/lib/usg/formf";
import type { UsgComposerState } from "@/lib/usg/types";

export type FormFOrderLite = {
  accessionNumber: string;
  patientName: string;
  patientAge: string;
  patientPhone: string;
  patientAddress: string;
  billNumber: string;
  referringDoctor: string;
  testName: string;
  studyDate: string | null;
};

export type FormFDefaults = {
  pcpndtCentreName: string;
  pcpndtRegistrationNo: string;
  pcpndtPlace: string;
  usgDoctorName: string;
  usgDoctorQual: string;
  usgDoctorRegNo: string;
};

type ExistingForm = {
  id: string;
  accessionNumber: string;
  billNumber: string;
  patientName: string;
  patientAge: string;
  husbandFatherName: string;
  address: string;
  mobile: string;
  childrenDetails: string;
  referredBy: string;
  lmpWeeks: string;
  previousChildIssue: string;
  indicationOther: string;
  gestationalAgeWeeks: string;
  gestationalAgeDays: string;
  ultrasoundResult: string;
  abnormality: string;
  procedureDate: string;
  consentDate: string;
  idCardVerified: boolean;
  reportId: string | null;
};

export function UsgFormFDialog({
  open, onClose, defaults, order, report, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaults: FormFDefaults;
  order?: FormFOrderLite | null;
  /** The OB report this Form F belongs to: { id, stateJson } — GA + result lift. */
  report?: { id: string; stateJson: string } | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<UsgFormFData>(() => defaultFormF(defaults));
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLIFrameElement>(null);

  const set = <K extends keyof UsgFormFData>(k: K, v: UsgFormFData[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Load existing record (by accession) or prefill from the order.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const init = async () => {
      setLoading(true);
      const base = defaultFormF(defaults);
      let next = base;
      let existingId: string | null = null;

      const acc = order?.accessionNumber ?? "";
      if (acc) {
        const r = await fetch(`/api/usg/formf?accession=${encodeURIComponent(acc)}`)
          .then((x) => x.json())
          .catch(() => null);
        const found: ExistingForm | undefined = r?.forms?.[0];
        if (found) {
          existingId = found.id;
          next = {
            ...base,
            accessionNumber: found.accessionNumber,
            billNumber: found.billNumber,
            patientName: found.patientName,
            age: found.patientAge,
            husbandFatherName: found.husbandFatherName,
            address: found.address,
            mobile: found.mobile,
            referredBy: found.referredBy.startsWith("Doctor") ? "Doctor" : "Self",
            referredByName: found.referredBy.replace(/^Doctor:\s*/, ""),
            lmpWeeks: found.lmpWeeks,
            previousChildIssue: found.previousChildIssue,
            indicationDetail: found.indicationOther,
            gestationalAgeWeeks: found.gestationalAgeWeeks,
            gestationalAgeDays: found.gestationalAgeDays,
            ultrasoundResult: found.ultrasoundResult.startsWith("Abnormal") ? "abnormal" : "normal",
            abnormality: found.abnormality,
            procedureDate: found.procedureDate,
            consentDate: found.consentDate,
          };
          const kids = found.childrenDetails ?? "";
          const boy = kids.match(/Boy:\s*(\d+)/i)?.[1] ?? "";
          const girl = kids.match(/Girl:\s*(\d+)/i)?.[1] ?? "";
          next.boyCount = boy;
          next.girlCount = girl;
        }
      }
      if (!existingId && order) {
        next = prefillFormFFromOrder(next, {
          accessionNumber: order.accessionNumber,
          patientName: order.patientName,
          patientAge: order.patientAge,
          patientPhone: order.patientPhone,
          patientAddress: order.patientAddress,
          billNumber: order.billNumber,
          referringDoctor: order.referringDoctor,
          testName: order.testName,
          studyDate: order.studyDate ? new Date(order.studyDate) : null,
        });
      }
      if (report?.stateJson) {
        try {
          const state = JSON.parse(report.stateJson) as UsgComposerState;
          next = applyComposerToFormF(next, state);
        } catch {
          /* state unreadable — keep the prefill */
        }
      }
      if (!alive) return;
      setForm(next);
      setSavedId(existingId);
      setLoading(false);
    };
    void init();
    return () => {
      alive = false;
    };
  }, [open, order?.accessionNumber, report?.id]);

  const completeness = useMemo(
    () =>
      evaluateFormFCompleteness({
        idCardVerified: form.idCardVerified ?? false,
        husbandFatherName: form.husbandFatherName,
        address: form.address,
        consentDate: form.consentDate,
        procedureDate: form.procedureDate,
      }),
    [form],
  );

  const payload = () => ({
    id: savedId ?? undefined,
    accessionNumber: form.accessionNumber,
    billNumber: form.billNumber,
    reportId: report?.id ?? null,
    patientName: form.patientName,
    patientAge: form.age,
    husbandFatherName: form.husbandFatherName,
    address: form.address,
    mobile: form.mobile,
    childrenDetails:
      [form.boyCount ? `Boy: ${form.boyCount}` : "", form.girlCount ? `Girl: ${form.girlCount}` : ""]
        .filter(Boolean)
        .join(", ") || "Not specified",
    referredBy: form.referredBy === "Doctor" ? `Doctor: ${form.referredByName}` : "Self",
    lmpWeeks: form.lmpWeeks,
    previousChildIssue: form.previousChildIssue || "Not applicable",
    indicationOther: form.indicationType === "routine" ? "Routine antenatal" : form.indicationDetail,
    gestationalAgeWeeks: form.gestationalAgeWeeks,
    gestationalAgeDays: form.gestationalAgeDays,
    ultrasoundResult: form.ultrasoundResult === "normal" ? "Normal" : `Abnormal: ${form.abnormality}`,
    abnormality: form.abnormality,
    procedureDate: form.procedureDate,
    consentDate: form.consentDate,
    idCardVerified: form.idCardVerified,
  });

  const save = async (): Promise<string | null> => {
    if (!form.patientName.trim()) {
      toast.error("Patient name is required");
      return null;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/usg/formf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      }).then((x) => x.json());
      if (r?.error) {
        toast.error(r.error);
        return null;
      }
      setSavedId(r.form.id);
      onSaved?.();
      return r.form.id as string;
    } catch {
      toast.error("Could not save Form F");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    setPrinting(true);
    try {
      const id = await save();
      if (!id && !form.patientName.trim()) return;
      const html = buildFormFPrintHtml(form);
      const frame = printRef.current;
      if (!frame) return;
      frame.srcdoc = html;
      const win = frame.contentWindow;
      if (win) {
        win.focus();
        setTimeout(() => win.print(), 200);
      }
    } finally {
      setPrinting(false);
    }
  };

  const inp = (k: keyof UsgFormFData, label: string, placeholder = "", w = "w-full") => (
    <div className={`grid gap-1 ${w}`}>
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</Label>
      <Input
        value={String(form[k] ?? "")}
        onChange={(e) => set(k, e.target.value as UsgFormFData[typeof k])}
        placeholder={placeholder}
        className="h-8 border-border bg-card text-[12.5px]"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="studio-scroll max-h-[90vh] w-[min(860px,95vw)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <FileCheck2 className="h-4 w-4 text-rose-600" />
            PC-PNDT Form F
            {form.accessionNumber ? (
              <span className="font-mono text-[10px] font-normal text-faint">{form.accessionNumber}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-[11.5px]">
            Clinic details and bill-desk demographics are pre-filled — verify, complete and print.
            {form.billNumber ? ` Bill ${form.billNumber}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-[12px] text-faint">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Patient block */}
            <section className="rounded-lg border border-border bg-panel/50 p-3">
              <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground">PATIENT</div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {inp("patientName", "Name", "as on bill")}
                {inp("age", "Age", "yrs", "w-[90px]")}
                {inp("husbandFatherName", "Husband / Father name")}
                {inp("mobile", "Mobile", "", "w-[130px]")}
                {inp("address", "Address", "from bill desk", "col-span-2 md:col-span-3")}
                <div className="grid grid-cols-2 gap-2">
                  {inp("boyCount", "Boys", "", "w-full")}
                  {inp("girlCount", "Girls", "", "w-full")}
                </div>
              </div>
            </section>

            {/* Clinical block */}
            <section className="rounded-lg border border-border bg-panel/50 p-3">
              <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground">CLINICAL</div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {inp("lmpWeeks", "LMP (weeks or date)", "e.g. 26 weeks")}
                <div className="grid grid-cols-2 gap-2">
                  {inp("gestationalAgeWeeks", "GA wks", "", "w-full")}
                  {inp("gestationalAgeDays", "GA days", "", "w-full")}
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Referred by</Label>
                  <div className="flex h-8 items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.referredBy === "Self"} onChange={() => set("referredBy", "Self")} className="h-3 w-3" />
                      Self
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.referredBy === "Doctor"} onChange={() => set("referredBy", "Doctor")} className="h-3 w-3" />
                      Doctor
                    </label>
                    {form.referredBy === "Doctor" ? (
                      <Input
                        value={form.referredByName}
                        onChange={(e) => set("referredByName", e.target.value)}
                        className="h-7 w-[110px] border-border bg-card text-[12px]"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Indication</Label>
                  <select
                    value={form.indicationType}
                    onChange={(e) => set("indicationType", e.target.value as UsgFormFData["indicationType"])}
                    className="h-8 rounded-md border border-border bg-card px-2 text-[12.5px]"
                  >
                    <option value="routine">Routine antenatal</option>
                    <option value="age">Advanced maternal age</option>
                    <option value="genetic">Genetic disease</option>
                    <option value="previous">Previous child issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {form.indicationType === "other" || form.indicationType === "previous"
                  ? inp("previousChildIssue", "Specify", "e.g. previous anomaly")
                  : null}
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">USG result</Label>
                  <div className="flex h-8 items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.ultrasoundResult === "normal"} onChange={() => set("ultrasoundResult", "normal")} className="h-3 w-3" />
                      Normal
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.ultrasoundResult === "abnormal"} onChange={() => set("ultrasoundResult", "abnormal")} className="h-3 w-3" />
                      Abnormal
                    </label>
                  </div>
                </div>
                {form.ultrasoundResult === "abnormal" ? inp("abnormality", "Abnormality", "finding summary") : null}
                {inp("procedureDate", "Procedure date", "yyyy-mm-dd", "w-[150px]")}
                {inp("consentDate", "Consent date (if any)", "yyyy-mm-dd", "w-[150px]")}
              </div>
            </section>

            {/* Statutory quick fields */}
            <section className="rounded-lg border border-border bg-panel/50 p-3">
              <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground">STATUTORY</div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Invasive procedure</Label>
                  <div className="flex h-8 items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.invasiveProcedure === "notdone"} onChange={() => set("invasiveProcedure", "notdone")} className="h-3 w-3" />
                      Not done
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.invasiveProcedure === "done"} onChange={() => set("invasiveProcedure", "done")} className="h-3 w-3" />
                      Done
                    </label>
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Complication</Label>
                  <div className="flex h-8 items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.complication === "nil"} onChange={() => set("complication", "nil")} className="h-3 w-3" />
                      Nil
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.complication === "specify"} onChange={() => set("complication", "specify")} className="h-3 w-3" />
                      Specify
                    </label>
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Lab tests</Label>
                  <div className="flex h-8 items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.labTests === "notadvised"} onChange={() => set("labTests", "notadvised")} className="h-3 w-3" />
                      Not advised
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" checked={form.labTests === "advised"} onChange={() => set("labTests", "advised")} className="h-3 w-3" />
                      Advised
                    </label>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 md:col-span-3">
                  <Checkbox
                    id="formf-idcard"
                    checked={!!form.idCardVerified}
                    onCheckedChange={(v) => set("idCardVerified", v === true)}
                  />
                  <label htmlFor="formf-idcard" className="flex items-center gap-1.5 text-[12px] font-medium">
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                    ID card verified against the patient
                  </label>
                </div>
              </div>
            </section>

            {/* Completeness */}
            {!completeness.complete ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <b>Form F incomplete — the ERP will refuse finalize until this is done:</b>{" "}
                  {completeness.missing.join(" ")}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
                <BadgeCheck className="h-3.5 w-3.5" /> Form F complete — satisfies the ERP&apos;s PC-PNDT gate.
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="h-9 gap-2 text-[12.5px]" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button className="h-9 gap-2 text-[12.5px]" onClick={() => void print()} disabled={printing}>
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Save &amp; print
              </Button>
            </div>
          </div>
        )}
        <iframe ref={printRef} title="formf-print" className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
