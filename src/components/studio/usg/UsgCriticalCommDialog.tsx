"use client";
/**
 * UsgCriticalCommDialog (v6.9) — Critical Findings Communication Log.
 *
 * Indian PCPNDT/NMC and ACR guidance: when a critical finding is detected,
 * the radiologist MUST document that they communicated it to the referring
 * physician — who, when, by what method, and whether the referring
 * physician acknowledged receipt. This dialog is the legal record.
 *
 * Mounted from the composer header (when a critical finding is active) and
 * from the ReportCard overflow menu (always available on finalized rows).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Phone, CheckCircle2, XCircle, Trash2, Plus } from "lucide-react";
import {
  COMMUNICATION_METHODS, methodLabel, formatCommDate,
  type CriticalCommunication,
} from "@/lib/usg/criticalComm";

export type UsgCriticalCommDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
  patientName: string;
  /** Pre-fill the finding text from the current impression's first line. */
  initialFinding?: string;
  /** Pre-fill the recipient (the referring doctor). */
  initialRecipient?: string;
};

export function UsgCriticalCommDialog({
  open, onOpenChange, reportId, patientName, initialFinding = "", initialRecipient = "",
}: UsgCriticalCommDialogProps) {
  const [entries, setEntries] = useState<CriticalCommunication[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New-entry form state
  const [findingText, setFindingText] = useState(initialFinding);
  const [communicatedTo, setCommunicatedTo] = useState(initialRecipient);
  const [communicatedAt, setCommunicatedAt] = useState<string>(() => {
    // Default to "now" in the local-time input format.
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [method, setMethod] = useState<string>("phone");
  const [notes, setNotes] = useState("");

  // Reset form defaults when opening fresh
  useEffect(() => {
    if (open) {
      setFindingText(initialFinding);
      setCommunicatedTo(initialRecipient);
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setCommunicatedAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
      setMethod("phone");
      setNotes("");
    }
  }, [open, initialFinding, initialRecipient]);

  const loadEntries = async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/usg/reports/${reportId}/critical-comm`);
      if (res.ok) {
        const d = (await res.json()) as { entries: CriticalCommunication[] };
        setEntries(d.entries);
      }
    } catch {
      // silent — the dialog stays usable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && reportId) void loadEntries();
  }, [open, reportId]);

  const submit = async () => {
    if (!reportId) return;
    if (!findingText.trim() || !communicatedTo.trim()) {
      toast.error("Finding text and recipient are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/usg/reports/${reportId}/critical-comm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingText: findingText.trim(),
          communicatedTo: communicatedTo.trim(),
          communicatedAt: new Date(communicatedAt).toISOString(),
          method,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Communication logged");
        await loadEntries();
        setFindingText(initialFinding);
        setNotes("");
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? `Save failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Save failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAck = async (entry: CriticalCommunication) => {
    if (!reportId) return;
    try {
      const res = await fetch(`/api/usg/reports/${reportId}/critical-comm/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: !entry.acknowledged }),
      });
      if (res.ok) {
        await loadEntries();
      } else {
        toast.error(`Ack failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Ack failed — ${(err as Error)?.message ?? "network error"}`);
    }
  };

  const remove = async (entry: CriticalCommunication) => {
    if (!reportId) return;
    if (!confirm(`Delete this log entry? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/usg/reports/${reportId}/critical-comm/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Entry removed");
        await loadEntries();
      } else {
        toast.error(`Delete failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Delete failed — ${(err as Error)?.message ?? "network error"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-rose-600" />
            Critical Finding Communication Log
          </DialogTitle>
          <DialogDescription>
            Document that you communicated the critical finding to the referring physician.
            Required by PCPNDT/NMC and ACR guidance — this is the legal record.
            <br />
            <span className="font-semibold">Patient:</span> {patientName}
          </DialogDescription>
        </DialogHeader>

        {/* Existing log entries */}
        {loading ? (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading log…
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
            No communication logged yet for this report.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold">
                        {methodLabel(e.method)}
                      </Badge>
                      <span className="font-semibold">{e.communicatedTo}</span>
                      <span className="text-faint">·</span>
                      <span className="text-muted-foreground">{formatCommDate(e.communicatedAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-foreground">{e.findingText}</p>
                    {e.notes ? <p className="mt-1 text-muted-foreground italic">"{e.notes}"</p> : null}
                    {e.acknowledged ? (
                      <div className="mt-1.5 flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Acknowledged by {e.acknowledgedBy ?? "—"} on {formatCommDate(e.acknowledgedAt)}
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1 text-amber-600">
                        <XCircle className="h-3 w-3" />
                        Acknowledgement pending
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => toggleAck(e)}
                      title={e.acknowledged ? "Mark as pending" : "Mark as acknowledged"}
                    >
                      {e.acknowledged ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {e.acknowledged ? "Unack" : "Ack"}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                      onClick={() => remove(e)}
                      title="Delete entry"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New entry form */}
        <div className="rounded-lg border-2 border-rose-200 bg-rose-50/50 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-bold text-rose-700">
            <Plus className="h-3.5 w-3.5" />
            Add a new communication log entry
          </p>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Finding communicated</Label>
              <Textarea
                value={findingText}
                onChange={(e) => setFindingText(e.target.value)}
                placeholder="E.g. Ectopic gestation with hemoperitoneum — needs urgent surgical consult"
                rows={2}
                className="bg-white text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Communicated to</Label>
                <Input
                  value={communicatedTo}
                  onChange={(e) => setCommunicatedTo(e.target.value)}
                  placeholder="Referring doctor name"
                  className="bg-white text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">When</Label>
              <Input
                type="datetime-local"
                value={communicatedAt}
                onChange={(e) => setCommunicatedAt(e.target.value)}
                className="bg-white text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Asked patient to come back tomorrow for recheck"
                className="bg-white text-xs"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full bg-rose-600 hover:bg-rose-700">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Log communication
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
