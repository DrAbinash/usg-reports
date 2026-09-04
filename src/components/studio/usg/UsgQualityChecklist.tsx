"use client";
/**
 * UsgQualityChecklist — pre-finalize quality check dialog.
 *
 * Before finalizing, shows a checklist of quality items (blockers + warnings).
 * Blockers (empty impression) prevent finalize. Warnings (missing GA, EDD,
 * placenta, etc.) can be acknowledged.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertOctagon, AlertTriangle, Check, ShieldCheck, ShieldAlert, X,
} from "lucide-react";
import {
  runQualityCheck, acknowledgeItem,
  type QualityCheckResult, type QualityCheckItem,
} from "@/lib/usg/qualityCheck";
import type { UsgComposerState, UsgResolved } from "@/lib/usg/types";

export type UsgQualityChecklistProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: UsgComposerState;
  resolved: UsgResolved;
  onForceFinalize: () => void;
};

export function UsgQualityChecklist({
  open, onOpenChange, state, resolved, onForceFinalize,
}: UsgQualityChecklistProps) {
  const initial = useMemo(() => runQualityCheck(state, resolved), [state, resolved]);
  const [result, setResult] = useState<QualityCheckResult>(initial);

  // Reset when reopened
  useMemo(() => { setResult(initial); }, [initial, open]);

  const handleAcknowledge = (i: number) => setResult(acknowledgeItem(result, i));
  const handleFinalize = () => { onForceFinalize(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.canFinalize ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            )}
            Quality Check
          </DialogTitle>
          <DialogDescription>
            {result.blockers > 0
              ? `${result.blockers} blocker${result.blockers > 1 ? "s" : ""} must be resolved before finalizing.`
              : result.warnings > 0
                ? `${result.warnings} warning${result.warnings > 1 ? "s" : ""} — acknowledge to proceed.`
                : "All checks passed. Ready to finalize."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
          {result.items.length === 0 && (
            <div className="flex flex-col items-center py-6 text-emerald-600">
              <Check className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">All quality checks passed</span>
            </div>
          )}

          {result.items.map((item, i) => (
            <QualityRow
              key={`${item.kind}-${i}`}
              item={item}
              onAcknowledge={() => handleAcknowledge(i)}
            />
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!result.canFinalize}
            onClick={handleFinalize}
            className={result.canFinalize ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <Check className="h-4 w-4 mr-1" />
            Finalize Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QualityRow({
  item, onAcknowledge,
}: { item: QualityCheckItem; onAcknowledge: () => void }) {
  const isBlocker = item.severity === "blocker";
  const Icon = isBlocker ? AlertOctagon : AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2",
        item.acknowledged && "opacity-50",
        isBlocker ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50",
      )}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", isBlocker ? "text-red-600" : "text-amber-600")} />

      <div className="min-w-0 flex-1">
        <p className="text-xs">{item.message}</p>
        {item.organKey && (
          <Badge variant="outline" className="mt-1 text-[10px] font-mono">
            {item.organKey}
          </Badge>
        )}
      </div>

      {!isBlocker && !item.acknowledged && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={onAcknowledge}
        >
          <Check className="h-3 w-3 mr-0.5" /> Ack
        </Button>
      )}
      {item.acknowledged && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          <Check className="h-3 w-3 mr-0.5" /> Acked
        </Badge>
      )}
    </div>
  );
}
