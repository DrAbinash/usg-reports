'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Activity,
  Clock,
  FileEdit,
  CheckCircle2,
  Ruler,
  Zap,
  Monitor,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUsgStore } from '@/store/usg-store';
import { STUDY_TYPES, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { mockExtractionProgress } from '@/lib/mock-data';
import type { Study } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatStudyDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getStudyTypeMeta(studyType: string) {
  return STUDY_TYPES.find((t) => t.value === studyType);
}

// ─── Stat Card ──────────────────────────────────────────────────────────────────

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

function StatItem({ label, value, icon, colorClass }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg border border-border px-4 py-3 shadow-sm">
      <div className={`flex items-center justify-center size-10 rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none ${colorClass.includes('text-') ? colorClass : ''}`}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Study Card ─────────────────────────────────────────────────────────────────

interface StudyCardProps {
  study: Study;
  onSelect: (study: Study) => void;
}

function StudyCard({ study, onSelect }: StudyCardProps) {
  const studyTypeMeta = getStudyTypeMeta(study.studyType);
  const statusColor = STATUS_COLORS[study.status] ?? 'bg-gray-100 text-gray-700';
  const statusLabel = STATUS_LABELS[study.status] ?? study.status;
  const measurementCount = study.measurements?.length ?? 0;

  // Derive a mock extraction progress per card based on status
  const progressPercent =
    study.status === 'signed' ? 100 :
    study.status === 'reporting' ? 85 :
    study.status === 'in-progress' ? 60 :
    study.status === 'qa' ? 92 : 30;

  const progressLabel =
    study.status === 'signed' ? 'Complete' :
    study.status === 'reporting' ? 'AI Analysis Complete' :
    study.status === 'in-progress' ? 'Extracting...' :
    study.status === 'qa' ? 'Quality Check' : 'Pending';

  const actionLabel =
    study.status === 'signed' ? 'View Report' :
    study.status === 'reporting' ? 'Continue' :
    study.status === 'in-progress' ? 'Continue' :
    study.status === 'qa' ? 'Review' : 'Start Reporting';

  const isSigned = study.status === 'signed';

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Card
        className={`cursor-pointer overflow-hidden py-0 gap-0 transition-colors hover:border-primary/30 ${
          isSigned ? 'opacity-80' : ''
        }`}
        onClick={() => onSelect(study)}
      >
        {/* Top color accent strip */}
        <div
          className="h-1 w-full"
          style={{
            background: study.studyType === 'OB'
              ? 'linear-gradient(90deg, #10b981, #14b8a6)'
              : study.studyType === 'PELVIS'
                ? 'linear-gradient(90deg, #a855f7, #7c3aed)'
                : study.studyType === 'ABDOMEN'
                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                  : study.studyType === 'THYROID'
                    ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                    : 'linear-gradient(90deg, #14b8a6, #0d9488)',
          }}
        />

        <CardContent className="p-4 flex flex-col gap-3">
          {/* Row 1: Type badge + Status */}
          <div className="flex items-center justify-between gap-2">
            {studyTypeMeta && (
              <Badge variant="secondary" className={`${studyTypeMeta.color} border-0 text-xs`}>
                {studyTypeMeta.label}
              </Badge>
            )}
            <Badge variant="secondary" className={`${statusColor} border-0 text-xs ml-auto`}>
              {statusLabel}
            </Badge>
          </div>

          {/* Row 2: Patient info */}
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              {study.patient?.name ?? 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {study.patient?.age}y {study.patient?.sex} &bull;{' '}
              <span className="font-mono">{study.patient?.uhid ?? '—'}</span>
            </p>
          </div>

          {/* Row 3: Description */}
          {study.studyDesc && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {study.studyDesc}
            </p>
          )}

          {/* Row 4: Meta info */}
          <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatStudyDate(study.studyDate)}
            </span>
            <span className="flex items-center gap-1">
              <Monitor className="size-3" />
              {study.machine}
            </span>
            {measurementCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs h-5 px-1.5">
                <Ruler className="size-3" />
                {measurementCount}
              </Badge>
            )}
          </div>

          {/* Row 5: AI Extraction Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Zap className="size-3 text-amber-500" />
                AI Extraction
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {progressPercent}% &mdash; {progressLabel}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {/* Row 6: Action button */}
          <Button
            variant={isSigned ? 'outline' : 'default'}
            size="sm"
            className="w-full mt-1 gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(study);
            }}
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Inbox className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No studies found</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        No studies match your current filter. Try adjusting the study type or search term.
      </p>
    </div>
  );
}

// ─── Main WorklistView ─────────────────────────────────────────────────────────

export default function WorklistView() {
  const { studies, setSelectedStudy } = useUsgStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Computed stats
  const stats = useMemo(() => {
    const total = studies.length;
    const pending = studies.filter((s) => s.status === 'pending').length;
    const inProgress = studies.filter((s) => s.status === 'in-progress').length;
    const reporting = studies.filter((s) => s.status === 'reporting' || s.status === 'qa').length;
    const signed = studies.filter((s) => s.status === 'signed').length;
    return { total, pending, inProgress, reporting, signed };
  }, [studies]);

  // Filtered & sorted studies
  const filteredStudies = useMemo(() => {
    let result = [...studies];

    // Filter by study type
    if (activeFilter !== 'ALL') {
      result = result.filter((s) => s.studyType === activeFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const name = s.patient?.name?.toLowerCase() ?? '';
        const uhid = s.patient?.uhid?.toLowerCase() ?? '';
        const desc = s.studyDesc?.toLowerCase() ?? '';
        return name.includes(q) || uhid.includes(q) || desc.includes(q);
      });
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.studyDate).getTime() - new Date(a.studyDate).getTime());

    return result;
  }, [studies, activeFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* ─── Stats Summary Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatItem
          label="Total Studies"
          value={stats.total}
          icon={<Activity className="size-5 text-teal-600" />}
          colorClass="bg-teal-50"
        />
        <StatItem
          label="Pending"
          value={stats.pending}
          icon={<Clock className="size-5 text-slate-600" />}
          colorClass="bg-slate-50"
        />
        <StatItem
          label="In Progress"
          value={stats.inProgress}
          icon={<Zap className="size-5 text-amber-600" />}
          colorClass="bg-amber-50"
        />
        <StatItem
          label="Reporting"
          value={stats.reporting}
          icon={<FileEdit className="size-5 text-emerald-600" />}
          colorClass="bg-emerald-50"
        />
        <StatItem
          label="Signed"
          value={stats.signed}
          icon={<CheckCircle2 className="size-5 text-teal-600" />}
          colorClass="bg-teal-50"
        />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground whitespace-nowrap">
            Study Worklist
          </h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-semibold">
            {filteredStudies.length}
          </Badge>
        </div>

        {/* Study type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap max-w-full overflow-x-auto pb-1">
          <Button
            variant={activeFilter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setActiveFilter('ALL')}
          >
            All
          </Button>
          {STUDY_TYPES.map((type) => {
            // Only show types that exist in the data
            const hasStudies = studies.some((s) => s.studyType === type.value);
            if (!hasStudies) return null;
            return (
              <Button
                key={type.value}
                variant={activeFilter === type.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => setActiveFilter(type.value)}
              >
                {type.label}
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search patient name or UHID..."
            className="pl-9 h-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Study Cards Grid ─── */}
      {filteredStudies.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudies.map((study) => (
            <StudyCard
              key={study.id}
              study={study}
              onSelect={setSelectedStudy}
            />
          ))}
        </div>
      )}
    </div>
  );
}