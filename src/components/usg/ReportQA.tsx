'use client';

import { useMemo } from 'react';
import {
  ShieldCheck,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUsgStore } from '@/store/usg-store';

type QaStatus = 'critical' | 'fail' | 'warning' | 'info' | 'pass';

interface QaItemView {
  id: string;
  check: string;
  status: QaStatus;
  message: string;
}

const statusConfig: Record<
  QaStatus,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    label: string;
    order: number;
  }
> = {
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-l-red-600',
    label: 'Critical',
    order: 0,
  },
  fail: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-l-red-400',
    label: 'Fail',
    order: 1,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-l-amber-500',
    label: 'Warning',
    order: 2,
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-l-blue-400',
    label: 'Info',
    order: 3,
  },
  pass: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-l-emerald-400',
    label: 'Pass',
    order: 4,
  },
};

function QaCard({ item }: { item: QaItemView }) {
  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-md border border-l-4 ${config.border} ${config.bg} p-3`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug">
            {item.check}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {item.message}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] h-5 px-1.5 border-current/20 ${config.color} shrink-0`}
        >
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

export default function ReportQA() {
  const reportQA = useUsgStore((s) => s.reportQA);
  const runReportQA = useUsgStore((s) => s.runReportQA);
  const selectedStudy = useUsgStore((s) => s.selectedStudy);

  const items = useMemo<QaItemView[]>(() => {
    return reportQA
      .map((r) => ({
        ...r,
        status: r.status as QaStatus,
      }))
      .sort((a, b) => {
        const aOrder = statusConfig[a.status]?.order ?? 5;
        const bOrder = statusConfig[b.status]?.order ?? 5;
        return aOrder - bOrder;
      });
  }, [reportQA]);

  const summary = useMemo(() => {
    const critical = items.filter((i) => i.status === 'critical').length;
    const fail = items.filter((i) => i.status === 'fail').length;
    const warning = items.filter((i) => i.status === 'warning').length;
    const info = items.filter((i) => i.status === 'info').length;
    const pass = items.filter((i) => i.status === 'pass').length;
    const issues = critical + fail + warning;
    return { critical, fail, warning, info, pass, issues, total: items.length };
  }, [items]);

  const hasOnlyInfo = items.length > 0 && summary.issues === 0;

  if (!selectedStudy) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a study to run quality checks.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Report QA
            </h3>
            {items.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {summary.issues > 0
                  ? `${summary.issues} issue${summary.issues !== 1 ? 's' : ''} found`
                  : `All ${summary.total} checks passed`}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={runReportQA}
        >
          <ShieldCheck className="size-3" />
          Run QA Check
        </Button>
      </div>

      {/* Summary bar (when there are issues) */}
      {items.length > 0 && summary.issues > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {summary.critical > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] h-5 px-1.5 bg-red-600"
            >
              {summary.critical} Critical
            </Badge>
          )}
          {summary.fail > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] h-5 px-1.5"
            >
              {summary.fail} Fail
            </Badge>
          )}
          {summary.warning > 0 && (
            <Badge
              className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 border-amber-200 border"
            >
              {summary.warning} Warning
            </Badge>
          )}
          {summary.info > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700"
            >
              {summary.info} Info
            </Badge>
          )}
          {summary.pass > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700"
            >
              {summary.pass} Pass
            </Badge>
          )}
        </div>
      )}

      {/* QA items list */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {items.map((item) => (
            <QaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex items-center justify-center size-10 rounded-full bg-slate-100 mb-2">
            <ShieldCheck className="size-5 text-slate-400" />
          </div>
          <p className="text-sm text-muted-foreground">
            Click &apos;Run QA Check&apos; to verify report quality
          </p>
        </div>
      )}

      {/* All pass state */}
      {hasOnlyInfo && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">
            All quality checks passed. Report ready for signing.
          </p>
        </div>
      )}
    </div>
  );
}