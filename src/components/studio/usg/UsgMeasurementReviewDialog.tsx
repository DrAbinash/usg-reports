"use client";
/**
 * UsgMeasurementReviewDialog — review gate before auto-populated measurements
 * from DICOM SR enter the composer.
 *
 * Shows each extracted measurement with its confidence score. The sonologist
 * can accept all, reject individual fields, or hand-correct any value.
 * Only accepted values are committed to the composer.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Check, CheckCheck, X, AlertTriangle, ShieldCheck, Pencil,
} from "lucide-react";
import {
  type MeasurementReviewSet, type ReviewedMeasurement,
  type MeasurementConfidence,
  buildReviewSet, toggleAccept, updateValue, acceptAll, rejectAll, getAcceptedVars,
} from "@/lib/usg/measurementReview";
import type { SrExtractResult } from "@/lib/usg/srExtract";
import type { SrMeasurement } from "@/lib/usg/srExtract";

export type UsgMeasurementReviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srResult: SrExtractResult;
  srMeasurements: SrMeasurement[];
  onAccept: (vars: Record<string, Record<string, string>>) => void;
};

const CONFIDENCE_STYLES: Record<MeasurementConfidence, string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-red-100 text-red-700 border-red-300",
  unmapped: "bg-gray-100 text-gray-500 border-gray-300",
};

const CONFIDENCE_ICONS: Record<MeasurementConfidence, typeof Check> = {
  high: ShieldCheck,
  medium: AlertTriangle,
  low: AlertTriangle,
  unmapped: AlertTriangle,
};

export function UsgMeasurementReviewDialog({
  open, onOpenChange, srResult, srMeasurements, onAccept,
}: UsgMeasurementReviewProps) {
  const initialSet = useMemo(
    () => buildReviewSet(srResult, srMeasurements),
    [srResult, srMeasurements],
  );
  const [reviewSet, setReviewSet] = useState<MeasurementReviewSet>(initialSet);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Reset when reopened
  useMemo(() => { setReviewSet(initialSet); }, [initialSet, open]);

  const handleToggle = (i: number) =>
    setReviewSet((s) => toggleAccept(s, i));

  const handleEdit = (i: number) => {
    setEditingIndex(i);
    setEditValue(reviewSet.measurements[i]?.value ?? "");
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      setReviewSet((s) => updateValue(s, editingIndex, editValue));
    }
    setEditingIndex(null);
  };

  const handleAccept = () => {
    onAccept(getAcceptedVars(reviewSet));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-600" />
            Review Machine Measurements
          </DialogTitle>
          <DialogDescription>
            {reviewSet.totalMatched} values extracted from DICOM SR.
            {reviewSet.hasLowConfidence && " Some values need your review."}
            {" "}Accept to fill the composer, or edit individual fields.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-1.5">
          {reviewSet.measurements.map((m, i) => (
            <MeasurementRow
              key={`${m.organ}-${m.varKey}-${i}`}
              measurement={m}
              index={i}
              accepted={m.accepted}
              editing={editingIndex === i}
              editValue={editValue}
              onToggle={() => handleToggle(i)}
              onEdit={() => handleEdit(i)}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingIndex(null)}
              onEditValueChange={setEditValue}
            />
          ))}
          {reviewSet.measurements.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No measurements extracted.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="text-xs text-muted-foreground mr-auto">
            {reviewSet.totalAccepted} / {reviewSet.totalMatched} accepted
          </div>
          <Button variant="outline" size="sm" onClick={() => setReviewSet(rejectAll)}>
            <X className="h-4 w-4 mr-1" /> Reject All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReviewSet(acceptAll(reviewSet))}>
            <CheckCheck className="h-4 w-4 mr-1" /> Accept All
          </Button>
          <Button size="sm" onClick={handleAccept} disabled={reviewSet.totalAccepted === 0}>
            <Check className="h-4 w-4 mr-1" /> Fill {reviewSet.totalAccepted} Value{reviewSet.totalAccepted !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeasurementRow({
  measurement: m, index, accepted, editing, editValue,
  onToggle, onEdit, onSaveEdit, onCancelEdit, onEditValueChange,
}: {
  measurement: ReviewedMeasurement;
  index: number;
  accepted: boolean;
  editing: boolean;
  editValue: string;
  onToggle: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
}) {
  const ConfIcon = CONFIDENCE_ICONS[m.confidence];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 transition-colors",
        accepted ? "border-emerald-200 bg-emerald-50/50" : "border-muted bg-muted/30",
        m.organ === "_unmapped" && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          accepted
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground/30 bg-background hover:border-emerald-400",
        )}
      >
        {accepted && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 text-sm"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">
              {m.organ === "_unmapped" ? m.varKey : `${m.organ} · ${m.varKey}`}
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {m.value} {m.unit}
            </span>
            <Button
              size="sm" variant="ghost" className="h-6 px-1.5"
              onClick={onEdit}
              title="Edit value"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <Badge
        variant="outline"
        className={cn("shrink-0 gap-1 text-[10px] font-medium", CONFIDENCE_STYLES[m.confidence])}
      >
        <ConfIcon className="h-3 w-3" />
        {m.confidence}
      </Badge>
    </div>
  );
}
