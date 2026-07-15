'use client';

import React, { useMemo, useState } from 'react';
import { useUsgStore } from '@/store/usg-store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MEASUREMENT_CATEGORIES, SOURCE_COLORS, SOURCE_LABELS, EXTRACTION_PRIORITY } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Measurement } from '@/lib/types';
import { Plus, Info } from 'lucide-react';

function getPercentileColor(p?: number) {
  if (p === undefined || p === null) return '';
  if (p < 10) return 'bg-red-100 text-red-700 border-red-200';
  if (p > 90) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function getConfidenceColor(c?: number) {
  if (c === undefined) return 'bg-gray-400';
  if (c > 0.95) return 'bg-emerald-500';
  if (c > 0.85) return 'bg-amber-500';
  return 'bg-red-500';
}

function isTextMeasurement(m: Measurement) {
  return m.value === 0 && (m.notes !== undefined && m.notes !== '');
}

interface CategoryTabProps {
  category: string;
  measurements: Measurement[];
  studyId: string;
}

function CategoryTab({ category, measurements, studyId }: CategoryTabProps) {
  const updateMeasurement = useUsgStore((s) => s.updateMeasurement);
  const addMeasurement = useUsgStore((s) => s.addMeasurement);

  const handleValueChange = (m: Measurement, newValue: string) => {
    const parsed = parseFloat(newValue);
    if (!isNaN(parsed)) {
      updateMeasurement(studyId, m.id, { value: parsed, isEdited: true });
    }
  };

  const handleNotesChange = (m: Measurement, newNotes: string) => {
    updateMeasurement(studyId, m.id, { notes: newNotes, isEdited: true });
  };

  const handleVerifyToggle = (m: Measurement, checked: boolean | 'indeterminate') => {
    updateMeasurement(studyId, m.id, { isVerified: checked === true });
  };

  const handleAddMeasurement = () => {
    const categoryInfo = MEASUREMENT_CATEGORIES[category as keyof typeof MEASUREMENT_CATEGORIES];
    const newItem = {
      name: '',
      value: 0,
      unit: '',
      category,
      source: 'manual' as const,
      confidence: 1,
      isVerified: false,
      isEdited: false,
    };
    const newMeas: Measurement = {
      id: `m-new-${Date.now()}`,
      studyId,
      ...newItem,
    };
    addMeasurement(studyId, newMeas);
  };

  if (measurements.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground">No measurements in this category</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs h-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
          onClick={handleAddMeasurement}
        >
          <Plus className="size-3 mr-1" /> Add Measurement
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="max-h-72 overflow-y-auto usg-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[140px]">Name</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[80px]">Value</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[50px]">Pctl</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[55px]">GA</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[80px]">Source</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[40px]">Conf</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground w-[36px] text-center">✓</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase text-muted-foreground">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {measurements.map((m) => {
              const isText = isTextMeasurement(m);
              return (
                <TableRow key={m.id} className={cn(
                  'group',
                  m.isEdited && 'bg-amber-50/50',
                  !m.isVerified && m.confidence && m.confidence < 0.85 && 'bg-red-50/30',
                )}>
                  {/* Name */}
                  <TableCell className="py-1.5 px-2">
                    <span className="text-xs font-semibold text-foreground">
                      {m.name}
                    </span>
                  </TableCell>

                  {/* Value */}
                  <TableCell className="py-1.5 px-1">
                    {isText ? (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <Input
                          type="number"
                          step="any"
                          value={m.value || ''}
                          onChange={(e) => handleValueChange(m, e.target.value)}
                          className={cn(
                            'h-6 w-14 text-xs px-1.5 py-0 tabular-nums',
                            'border-border/60 focus-visible:ring-teal-500/30 focus-visible:border-teal-500',
                          )}
                        />
                        {m.unit && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{m.unit}</span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Percentile */}
                  <TableCell className="py-1.5 px-1">
                    {m.percentile !== undefined && m.percentile !== null ? (
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1 py-0 h-5 font-medium', getPercentileColor(m.percentile))}
                      >
                        {m.percentile}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Gestational Age */}
                  <TableCell className="py-1.5 px-1">
                    {m.gestationalAge ? (
                      <span className="text-[10px] text-muted-foreground font-medium">{m.gestationalAge}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Source */}
                  <TableCell className="py-1.5 px-1">
                    <span className={cn('text-[10px] font-medium', SOURCE_COLORS[m.source] || 'text-muted-foreground')}>
                      {SOURCE_LABELS[m.source] || m.source}
                    </span>
                  </TableCell>

                  {/* Confidence bar */}
                  <TableCell className="py-1.5 px-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', getConfidenceColor(m.confidence))}
                          style={{ width: `${(m.confidence || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-muted-foreground tabular-nums">
                        {m.confidence !== undefined ? `${(m.confidence * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  </TableCell>

                  {/* Verify checkbox */}
                  <TableCell className="py-1.5 px-1 text-center">
                    <Checkbox
                      checked={m.isVerified}
                      onCheckedChange={(checked) => handleVerifyToggle(m, checked)}
                      className="size-3.5"
                    />
                  </TableCell>

                  {/* Notes */}
                  <TableCell className="py-1.5 px-1">
                    <Input
                      value={m.notes || ''}
                      onChange={(e) => handleNotesChange(m, e.target.value)}
                      placeholder={isText ? m.notes : 'Notes...'}
                      className="h-6 text-[10px] px-1.5 py-0 border-border/40 focus-visible:ring-teal-500/30 focus-visible:border-teal-500 min-w-[80px]"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add button */}
      <div className="pt-2 pb-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
          onClick={handleAddMeasurement}
        >
          <Plus className="size-3 mr-1" /> Add Measurement
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ measurements }: { measurements: Measurement[] }) {
  const getVal = (name: string) => measurements.find((m) => m.name === name);
  const ga = getVal('GA');
  const efw = getVal('EFW');
  const afi = getVal('AFI');
  const fhr = getVal('FHR');

  return (
    <div className="flex flex-wrap gap-3 px-2 py-2 bg-muted/40 rounded-md mt-1">
      {ga && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">GA</span>
          <span className="text-xs font-bold text-foreground">{ga.value} {ga.unit}</span>
        </div>
      )}
      {efw && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">EFW</span>
          <span className="text-xs font-bold text-foreground">{efw.value} {efw.unit}</span>
        </div>
      )}
      {afi && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">AFI</span>
          <span className="text-xs font-bold text-foreground">{afi.value} {afi.unit}</span>
        </div>
      )}
      {fhr && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">FHR</span>
          <span className="text-xs font-bold text-foreground">{fhr.value} {fhr.unit}</span>
        </div>
      )}
    </div>
  );
}

export default function MeasurementsTable() {
  const selectedStudy = useUsgStore((s) => s.selectedStudy);
  const [activeTab, setActiveTab] = useState<string>('');

  const measurements = selectedStudy?.measurements ?? [];

  const groupedByCategory = useMemo(() => {
    const map: Record<string, Measurement[]> = {};
    for (const m of measurements) {
      const cat = m.category || 'OTHER';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    }
    return map;
  }, [measurements]);

  const availableCategories = useMemo(() => {
    return Object.keys(groupedByCategory).filter(
      (cat) => cat in MEASUREMENT_CATEGORIES
    );
  }, [groupedByCategory]);

  // Auto-select first available tab
  const effectiveTab = activeTab && availableCategories.includes(activeTab) ? activeTab : availableCategories[0] || '';

  // If no measurements at all
  if (measurements.length === 0) {
    return (
      <Card className="py-4 gap-4">
        <CardHeader className="pb-0 px-6">
          <CardTitle className="text-sm font-semibold">Measurements</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No measurements extracted yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Measurements are auto-extracted in order of priority:
            </p>
            <ol className="mt-3 text-xs text-muted-foreground/60 space-y-1 text-left">
              {EXTRACTION_PRIORITY.map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="size-4 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  const studyType = selectedStudy?.studyType;

  return (
    <Card className="py-4 gap-4">
      <CardHeader className="pb-0 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Measurements
            <Badge variant="secondary" className="ml-2 text-[10px]">{measurements.length}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Tabs value={effectiveTab} onValueChange={setActiveTab}>
          <TabsList className="h-7 p-0.5 bg-muted/60">
            {availableCategories.map((cat) => {
              const info = MEASUREMENT_CATEGORIES[cat as keyof typeof MEASUREMENT_CATEGORIES];
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="text-[10px] h-6 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {info?.label || cat}
                  <span className="ml-1 text-[9px] text-muted-foreground">
                    ({(groupedByCategory[cat] || []).length})
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {availableCategories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <CategoryTab
                category={cat}
                measurements={groupedByCategory[cat] || []}
                studyId={selectedStudy!.id}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Summary row for OB studies */}
        {studyType === 'OB' && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 px-1">Summary</p>
            <SummaryRow measurements={measurements} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}