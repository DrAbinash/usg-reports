"use client";
/**
 * UsgBiradsPicker (v6.10) — BI-RADS assessment category picker for breast studies.
 *
 * Shows a dropdown of the 9 BI-RADS categories (0/1/2/3/4A/4B/4C/5/6) with
 * their recommendation and malignancy risk. When a category is selected,
 * the corresponding impression line is appended to the report's impression
 * and (for BI-RADS 3) a follow-up reminder is suggested.
 *
 * Mounted in UsgComposer when the study is a breast study and the
 * enableBirads toggle is on.
 */
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BIRADS_OPTIONS, getBiradsOption, biradsImpressionLine, type BiradsCategory } from "@/lib/usg/birads";
import { ShieldAlert } from "lucide-react";

export type UsgBiradsPickerProps = {
  /** The currently-selected category (controlled). */
  value: string | null;
  /** Callback when the doctor picks a category. */
  onChange: (value: BiradsCategory | null) => void;
};

export function UsgBiradsPicker({ value, onChange }: UsgBiradsPickerProps) {
  const opt = getBiradsOption(value);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-[11px] font-bold text-violet-900">BI-RADS Assessment</span>
        <span className="text-[9px] text-muted-foreground">ACR 5th edition</span>
      </div>
      <Select
        value={value ?? ""}
        onValueChange={(v) => onChange(v as BiradsCategory)}
      >
        <SelectTrigger className="h-8 bg-white text-[11px]">
          <SelectValue placeholder="Select BI-RADS category…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Assessment category</SelectLabel>
            {BIRADS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[11px]">
                <span className="font-semibold">{o.label}</span>
                <span className="ml-1 text-muted-foreground">— {o.fullLabel.replace(/^BI-RADS \S+\s+—\s+/, "")}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {opt ? (
        <div className="mt-1.5 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-violet-700">
              Risk: {opt.malignancyRisk}
            </Badge>
            {opt.followUpDays ? (
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-amber-700">
                Follow-up: {Math.round(opt.followUpDays / 30)} mo
              </Badge>
            ) : null}
            {opt.recommendation.includes("biopsy") ? (
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-red-700">
                Biopsy
              </Badge>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {opt.recommendation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
