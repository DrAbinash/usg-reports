'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useUsgStore } from '@/store/usg-store';

export default function ScanChecklist() {
  const checklist = useUsgStore((s) => s.checklist);
  const toggleChecklistItem = useUsgStore((s) => s.toggleChecklistItem);

  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  const grouped = useMemo(() => {
    const map = new Map<string, typeof checklist>();
    for (const item of checklist) {
      const cat = item.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [checklist]);

  const summary = useMemo(() => {
    const total = checklist.length;
    const complete = checklist.filter((i) => i.isComplete).length;
    const mandatoryTotal = checklist.filter((i) => i.isMandatory).length;
    const mandatoryComplete = checklist.filter(
      (i) => i.isMandatory && i.isComplete
    ).length;
    return { total, complete, mandatoryTotal, mandatoryComplete, pct: total > 0 ? (complete / total) * 100 : 0 };
  }, [checklist]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (checklist.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a study to view the scan checklist.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
          <ClipboardCheck className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            Scan Checklist
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {summary.complete} of {summary.total} complete
            {summary.mandatoryTotal > 0 &&
              ` · ${summary.mandatoryComplete}/${summary.mandatoryTotal} mandatory`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={summary.pct}
          className="h-1.5 [&>div]:bg-emerald-500"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{summary.pct.toFixed(0)}% complete</span>
          {summary.mandatoryComplete < summary.mandatoryTotal && (
            <span className="flex items-center gap-0.5 text-amber-600">
              <AlertTriangle className="size-3" />
              {summary.mandatoryTotal - summary.mandatoryComplete} mandatory remaining
            </span>
          )}
        </div>
      </div>

      {/* Checklist items grouped by category */}
      <div className="flex flex-col gap-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {grouped.map(([category, items]) => {
          const isCollapsed = collapsedCategories[category] ?? false;
          const catComplete = items.filter((i) => i.isComplete).length;
          const catTotal = items.length;

          return (
            <div key={category} className="rounded-md border bg-background">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-md"
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-medium text-foreground flex-1">
                  {category}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {catComplete}/{catTotal}
                </span>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="px-2 pb-2 space-y-0.5">
                  {items.map((item) => {
                    const isIncompleteMandatory =
                      !item.isComplete && item.isMandatory;

                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-muted/30 ${
                          isIncompleteMandatory ? 'border-l-2 border-l-red-400 -ml-px pl-[calc(0.5rem-1px)]' : ''
                        } ${
                          item.isComplete
                            ? 'text-emerald-700'
                            : 'text-foreground'
                        }`}
                      >
                        <Checkbox
                          checked={item.isComplete}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                          className={
                            item.isComplete
                              ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600'
                              : ''
                          }
                        />
                        <span
                          className={`text-xs flex-1 transition-colors ${
                            item.isComplete ? 'line-through opacity-70' : ''
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.isMandatory && (
                          <span className="text-red-500 text-xs font-medium leading-none">
                            *
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}