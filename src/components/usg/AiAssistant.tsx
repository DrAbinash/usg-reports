'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUsgStore } from '@/store/usg-store';
import type { AiSuggestion, SuggestionSeverity } from '@/lib/types';

const severityOrder: SuggestionSeverity[] = ['critical', 'warning', 'info'];

const severityConfig: Record<
  SuggestionSeverity,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-l-red-500',
    label: 'Critical',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-l-amber-500',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-l-blue-500',
    label: 'Info',
  },
};

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: AiSuggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`rounded-md border border-l-4 ${config.border} ${config.bg} p-3`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {suggestion.message}
          </p>
          {suggestion.source && (
            <Badge
              variant="secondary"
              className="mt-1.5 text-[10px] px-1.5 py-0 h-4 font-normal"
            >
              {suggestion.source}
            </Badge>
          )}
        </div>
        {suggestion.isAccepted && (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        )}
      </div>
      {!suggestion.isAccepted && (
        <div className="mt-2 flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onDismiss(suggestion.id)}
          >
            <X className="size-3" />
            Dismiss
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onAccept(suggestion.id)}
          >
            <CheckCircle2 className="size-3" />
            Accept
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export default function AiAssistant() {
  const selectedStudy = useUsgStore((s) => s.selectedStudy);
  const dismissSuggestion = useUsgStore((s) => s.dismissSuggestion);
  const acceptSuggestion = useUsgStore((s) => s.acceptSuggestion);

  const suggestions = useMemo(() => {
    const list = selectedStudy?.aiSuggestions;
    if (!list) return [];
    return list
      .filter((s) => !s.isDismissed)
      .sort((a, b) => {
        const aIdx = severityOrder.indexOf(a.severity);
        const bIdx = severityOrder.indexOf(b.severity);
        return aIdx - bIdx;
      });
  }, [selectedStudy]);

  const summary = useMemo(() => {
    const active = suggestions.filter((s) => !s.isDismissed);
    const findings = active.filter(
      (s) => s.category === 'finding' || s.category === 'comparison'
    ).length;
    const alerts = active.filter(
      (s) => s.severity === 'critical' || s.severity === 'warning'
    ).length;
    const quality = active.filter((s) => s.category === 'quality').length;
    return { findings, alerts, quality, total: active.length };
  }, [suggestions]);

  if (!selectedStudy) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a study to view AI suggestions.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            AI Sonologist Assistant
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {summary.total > 0
              ? `${summary.findings} findings, ${summary.alerts} alerts, ${summary.quality} quality notes`
              : 'All clear. No active AI suggestions.'}
          </p>
        </div>
      </div>

      {/* Suggestions list */}
      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <div className="flex items-center justify-center size-10 rounded-full bg-emerald-50 mb-2">
            <CheckCircle2 className="size-5 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            All clear. No active AI suggestions.
          </p>
        </motion.div>
      )}
    </div>
  );
}