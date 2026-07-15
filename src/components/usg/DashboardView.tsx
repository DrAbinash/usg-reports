'use client';

import { useMemo } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  Activity,
  Droplets,
  Baby,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUsgStore } from '@/store/usg-store';
import { mockGrowthData, mockEfwTrend, mockAfiTrend } from '@/lib/mock-data';

// Color constants
const TEAL_500 = '#14b8a6';
const TEAL_300 = '#5eead4';
const TEAL_600 = '#0d9488';
const EMERALD_500 = '#10b981';
const AMBER_500 = '#f59e0b';
const RED_500 = '#ef4444';

// Mock study history for the patient
const mockStudyHistory = [
  { date: '2025-01-15', ga: '32w2d', bpd: 82.3, hc: 298.5, ac: 281.2, fl: 61.4, efw: 1820, afi: 14.2 },
  { date: '2025-01-05', ga: '28w0d', bpd: 72.1, hc: 265.8, ac: 248.6, fl: 53.2, efw: 1120, afi: 13.2 },
  { date: '2024-12-28', ga: '24w0d', bpd: 58.8, hc: 218.4, ac: 206.1, fl: 43.5, efw: 680, afi: 14.5 },
  { date: '2024-12-01', ga: '18w0d', bpd: 42.5, hc: 164.2, ac: 142.3, fl: 29.8, efw: 320, afi: 13.8 },
  { date: '2024-10-20', ga: '12w0d', bpd: 21.0, hc: 78.5, ac: 62.4, fl: 12.0, efw: null, afi: 12.5 },
];

function getPercentileColor(p: number | undefined): string {
  if (p === undefined) return 'text-muted-foreground';
  if (p < 10 || p > 90) return 'text-red-500';
  if (p < 25 || p > 75) return 'text-amber-500';
  return 'text-emerald-600';
}

function getPercentileBadge(p: number | undefined): { label: string; className: string } {
  if (p === undefined) return { label: '—', className: 'bg-slate-100 text-slate-600' };
  if (p < 5) return { label: `< 5th`, className: 'bg-red-100 text-red-700' };
  if (p < 10) return { label: 'Low', className: 'bg-red-100 text-red-700' };
  if (p < 25) return { label: 'Below Avg', className: 'bg-amber-100 text-amber-700' };
  if (p <= 75) return { label: 'Average', className: 'bg-emerald-100 text-emerald-700' };
  if (p <= 90) return { label: 'Above Avg', className: 'bg-amber-100 text-amber-700' };
  return { label: '> 90th', className: 'bg-red-100 text-red-700' };
}

function getAfiColor(value: number): string {
  if (value < 8) return RED_500;
  if (value <= 24) return TEAL_500;
  return RED_500;
}

function getAfiStatus(value: number): string {
  if (value < 8) return 'Low';
  if (value <= 24) return 'Normal';
  return 'High';
}

export default function DashboardView() {
  const { selectedStudy, setActiveView } = useUsgStore();

  const measurements = useMemo(() => {
    return selectedStudy?.measurements || [];
  }, [selectedStudy]);

  const patientName = selectedStudy?.patient?.name || 'Patient';
  const studyGa = selectedStudy?.measurements?.find((m) => m.name === 'GA')?.gestationalAge;

  // Prepare AFI bar data with color info
  const afiBarData = useMemo(() => {
    return mockAfiTrend.map((d) => ({
      ...d,
      fill: d.value < 8 || d.value > 24
        ? d.value < 5 || d.value > 25
          ? RED_500
          : AMBER_500
        : TEAL_500,
      status: getAfiStatus(d.value),
    }));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveView('worklist')}
          aria-label="Back to worklist"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pregnancy Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {patientName}
            {studyGa && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {studyGa}
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. BPD Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-teal-600" />
              Biparietal Diameter Growth
            </CardTitle>
            <CardDescription>BPD trend with percentile bands</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="gestationalAge"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `${v}w`}
                    label={{ value: 'Gestational Age (weeks)', position: 'insideBottom', offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: 'BPD (mm)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        value: 'Measured BPD',
                        percentile5: '5th Percentile',
                        percentile50: '50th Percentile',
                        percentile95: '95th Percentile',
                      };
                      return [`${value} mm`, labels[name] || name];
                    }}
                    labelFormatter={(label: number) => `GA: ${label} weeks`}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        value: 'Measured BPD',
                        percentile5: '5th %ile',
                        percentile50: '50th %ile',
                        percentile95: '95th %ile',
                      };
                      return labels[value] || value;
                    }}
                  />
                  {/* Percentile bands */}
                  <Line
                    type="monotone"
                    dataKey="percentile5"
                    stroke={TEAL_300}
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentile50"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentile95"
                    stroke={TEAL_300}
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  {/* Actual measurements */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={TEAL_500}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: TEAL_500, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: TEAL_500, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 2. EFW Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Baby className="size-4 text-teal-600" />
              Estimated Fetal Weight
            </CardTitle>
            <CardDescription>EFW trend over gestation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockEfwTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="efwGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TEAL_500} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={TEAL_500} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="gestationalAge"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `${v}w`}
                    label={{ value: 'Gestational Age (weeks)', position: 'insideBottom', offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Weight (g)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value} g`, 'EFW']}
                    labelFormatter={(label: number) => `GA: ${label} weeks`}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={TEAL_500}
                    strokeWidth={2.5}
                    fill="url(#efwGradient)"
                    dot={{ r: 5, fill: TEAL_500, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: TEAL_500, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. AFI Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="size-4 text-teal-600" />
              Amniotic Fluid Index Trend
            </CardTitle>
            <CardDescription>
              Normal range: 8–24 cm
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
                <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> Borderline
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Abnormal
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={afiBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="gestationalAge"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `${v}w`}
                    label={{ value: 'Gestational Age (weeks)', position: 'insideBottom', offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    domain={[0, 30]}
                    label={{ value: 'AFI (cm)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, _name: string, props: { payload: { status: string } }) => {
                      return [`${value} cm — ${props.payload.status}`, 'AFI'];
                    }}
                    labelFormatter={(label: number) => `GA: ${label} weeks`}
                  />
                  <ReferenceLine
                    y={8}
                    stroke={RED_500}
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: 'Low (8)', position: 'insideTopLeft', fill: RED_500, fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={24}
                    stroke={RED_500}
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: 'High (24)', position: 'insideTopRight', fill: RED_500, fontSize: 10 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {afiBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Current Measurements Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-teal-600" />
              Current Study Measurements
            </CardTitle>
            <CardDescription>All measurements from the selected study</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Measurement</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Percentile</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {measurements.map((m) => {
                    const badge = getPercentileBadge(m.percentile);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className={`text-right font-mono ${getPercentileColor(m.percentile)}`}>
                          {m.value}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {m.unit || '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${getPercentileColor(m.percentile)}`}>
                          {m.percentile !== undefined ? `${m.percentile}` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {measurements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No measurements available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Study History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-teal-600" />
            Previous Studies
          </CardTitle>
          <CardDescription>Historical ultrasound records for this patient</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>GA</TableHead>
                  <TableHead className="text-right">BPD</TableHead>
                  <TableHead className="text-right">HC</TableHead>
                  <TableHead className="text-right">AC</TableHead>
                  <TableHead className="text-right">FL</TableHead>
                  <TableHead className="text-right">EFW (g)</TableHead>
                  <TableHead className="text-right">AFI (cm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStudyHistory.map((study, i) => (
                  <TableRow key={study.date} className={i === 0 ? 'bg-teal-50/50' : ''}>
                    <TableCell className="font-medium">
                      {new Date(study.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {i === 0 && (
                        <Badge variant="default" className="ml-2 bg-teal-600 text-white text-[10px] px-1.5 py-0">
                          Current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {study.ga}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{study.bpd}</TableCell>
                    <TableCell className="text-right font-mono">{study.hc}</TableCell>
                    <TableCell className="text-right font-mono">{study.ac}</TableCell>
                    <TableCell className="text-right font-mono">{study.fl}</TableCell>
                    <TableCell className="text-right font-mono">{study.efw ?? '—'}</TableCell>
                    <TableCell className={`text-right font-mono ${study.afi < 8 || study.afi > 24 ? 'text-red-500 font-semibold' : ''}`}>
                      {study.afi}
                      {study.afi < 8 && (
                        <AlertTriangle className="ml-1 inline size-3 text-red-500" />
                      )}
                      {study.afi > 24 && (
                        <AlertTriangle className="ml-1 inline size-3 text-red-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}