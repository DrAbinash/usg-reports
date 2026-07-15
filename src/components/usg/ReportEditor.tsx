'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUsgStore } from '@/store/usg-store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { STATUS_COLORS, STATUS_LABELS, MACHINE_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  FileSignature,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';

interface ReportSectionProps {
  label: string;
  field: string;
  value: string;
  studyId: string;
  isAiDrafted?: boolean;
  multiline?: boolean;
  medium?: boolean;
  placeholder?: string;
}

function ReportSection({
  label,
  field,
  value,
  studyId,
  isAiDrafted = false,
  multiline = false,
  medium = false,
  placeholder = '',
}: ReportSectionProps) {
  const updateReport = useUsgStore((s) => s.updateReport);
  const [localValue, setLocalValue] = useState(value);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setLocalValue(newVal);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateReport(studyId, { [field]: newVal });
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }, 400);
    },
    [field, studyId, updateReport]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const inputClasses = cn(
    'text-sm border-border/60 focus-visible:ring-teal-500/30 focus-visible:border-teal-500',
    'bg-background/50 resize-none'
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </Label>
        {isAiDrafted && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5 bg-teal-50 text-teal-700 border-teal-200">
            <Sparkles className="size-2.5" /> AI Drafted
          </Badge>
        )}
        {lastSaved && (
          <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5 ml-auto">
            <Clock className="size-2.5" />
            {lastSaved}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            inputClasses,
            medium ? 'min-h-[120px]' : 'min-h-[200px] text-sm leading-relaxed'
          )}
        />
      ) : (
        <Input
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
    </div>
  );
}

export default function ReportEditor() {
  const selectedStudy = useUsgStore((s) => s.selectedStudy);
  const updateStudyStatus = useUsgStore((s) => s.updateStudyStatus);
  const runReportQA = useUsgStore((s) => s.runReportQA);
  const reportQA = useUsgStore((s) => s.reportQA);
  const [isRunningQA, setIsRunningQA] = useState(false);

  const report = selectedStudy?.report;
  const studyId = selectedStudy?.id;
  const studyStatus = selectedStudy?.status;

  const handleRunQA = async () => {
    setIsRunningQA(true);
    // Simulate a brief async operation
    await new Promise((resolve) => setTimeout(resolve, 300));
    runReportQA();
    setIsRunningQA(false);
  };

  const handleSignReport = () => {
    if (!studyId) return;
    updateStudyStatus(studyId, 'signed');
  };

  if (!selectedStudy || !studyId) return null;

  // Determine if findings/impression were AI-drafted (non-empty initial values)
  const hasFindings = (report?.findings?.length ?? 0) > 0;
  const hasImpression = (report?.impression?.length ?? 0) > 0;

  return (
    <Card className="py-4 gap-0 overflow-hidden">
      <CardHeader className="pb-3 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Report</CardTitle>
          {studyStatus && (
            <Badge
              variant="secondary"
              className={cn('text-[10px]', STATUS_COLORS[studyStatus] || '')}
            >
              {STATUS_LABELS[studyStatus] || studyStatus}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 space-y-4 pb-4">
        {/* Clinical Information */}
        <ReportSection
          label="Clinical Information"
          field="clinicalInfo"
          value={report?.clinicalInfo || ''}
          studyId={studyId}
          placeholder="e.g. 32 weeks GA, routine anomaly scan"
        />

        <Separator />

        {/* Technique */}
        <ReportSection
          label="Technique"
          field="technique"
          value={report?.technique || `Transabdominal ultrasound, ${MACHINE_NAME}.`}
          studyId={studyId}
          placeholder="Technique description"
        />

        <Separator />

        {/* Comparison */}
        <ReportSection
          label="Comparison"
          field="comparison"
          value={report?.comparison || ''}
          studyId={studyId}
          placeholder="e.g. Compared with previous USG dated..."
        />

        <Separator />

        {/* Findings */}
        <ReportSection
          label="Findings"
          field="findings"
          value={report?.findings || ''}
          studyId={studyId}
          isAiDrafted={hasFindings}
          multiline
          placeholder="Detailed findings..."
        />

        <Separator />

        {/* Impression */}
        <ReportSection
          label="Impression"
          field="impression"
          value={report?.impression || ''}
          studyId={studyId}
          isAiDrafted={hasImpression}
          multiline
          placeholder="Impression / Conclusion..."
        />

        <Separator />

        {/* Recommendation */}
        <ReportSection
          label="Recommendation"
          field="recommendation"
          value={report?.recommendation || ''}
          studyId={studyId}
          multiline
          medium
          placeholder="Recommendations if any..."
        />

        {/* QA Results Summary (if any) */}
        {reportQA.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  QA Results
                </Label>
                <Badge
                  variant="destructive"
                  className="text-[9px] h-4 px-1.5"
                >
                  {reportQA.filter((q) => q.status === 'fail').length} issues
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-300"
                >
                  {reportQA.filter((q) => q.status === 'warning').length} warnings
                </Badge>
              </div>
              <div className="max-h-28 overflow-y-auto usg-scrollbar space-y-1">
                {reportQA.map((qa) => (
                  <div
                    key={qa.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-2 py-1 text-[10px]',
                      qa.status === 'fail' && 'bg-red-50 text-red-800',
                      qa.status === 'warning' && 'bg-amber-50 text-amber-800',
                      qa.status === 'info' && 'bg-blue-50 text-blue-800',
                    )}
                  >
                    <span className="font-semibold shrink-0 mt-px">
                      {qa.status === 'fail' ? '✕' : qa.status === 'warning' ? '⚠' : 'ℹ'}
                    </span>
                    <span>{qa.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Bottom action bar */}
      <CardFooter className="px-6 py-3 bg-muted/30 border-t flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
            onClick={handleRunQA}
            disabled={isRunningQA}
          >
            {isRunningQA ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Run QA Check
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSignReport}
            disabled={studyStatus === 'signed'}
          >
            <FileSignature className="size-3.5" />
            Sign Report
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {report?.reportStatus && (
            <Badge
              variant="outline"
              className="text-[10px] capitalize"
            >
              Report: {report.reportStatus}
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}