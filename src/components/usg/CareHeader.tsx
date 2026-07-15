'use client';

import { useState } from 'react';
import {
  ScanLine,
  Bell,
  Settings,
  ChevronDown,
  User,
  LayoutList,
  FileText,
  BarChart3,
  ShieldCheck,
  X,
  CalendarDays,
  Stethoscope,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUsgStore } from '@/store/usg-store';
import { STUDY_TYPES, STATUS_COLORS, STATUS_LABELS, APP_NAME } from '@/lib/constants';
import type { ViewMode } from '@/lib/types';

const NAV_TABS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'worklist', label: 'Worklist', icon: <LayoutList className="size-4" /> },
  { value: 'study', label: 'Report', icon: <FileText className="size-4" /> },
  { value: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="size-4" /> },
  { value: 'pcpndt', label: 'PCPNDT', icon: <ShieldCheck className="size-4" /> },
];

export default function CareHeader() {
  const { activeView, setActiveView, selectedStudy, setSelectedStudy } = useUsgStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const studyTypeMeta = STUDY_TYPES.find((t) => t.value === selectedStudy?.studyType);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-border shadow-sm">
      {/* Main header row */}
      <div className="flex items-center justify-between px-3 md:px-6 py-2.5 gap-3">
        {/* Left: Logo + App Name + Machine Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground shrink-0">
            <ScanLine className="size-5" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-bold text-foreground leading-tight truncate">
              {APP_NAME}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                GE Voluson E9 &bull; Connected
              </span>
            </div>
          </div>
        </div>

        {/* Center: Navigation Tabs — hidden on mobile */}
        <nav className="hidden md:flex items-center" aria-label="Main navigation">
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-[3px]">
            {NAV_TABS.map((tab) => {
              const isActive = activeView === tab.value || (tab.value === 'worklist' && activeView === 'worklist');
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveView(tab.value)}
                  className={`
                    inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
                    transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: Doctor info, Bell, Settings */}
        <div className="flex items-center gap-2">
          {/* Mobile nav dropdown */}
          <DropdownMenu open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LayoutList className="size-4" />
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {NAV_TABS.map((tab) => (
                <DropdownMenuItem
                  key={tab.value}
                  onClick={() => {
                    setActiveView(tab.value);
                    setMobileNavOpen(false);
                  }}
                  className={activeView === tab.value ? 'bg-accent' : ''}
                >
                  {tab.icon}
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="relative size-9">
            <Bell className="size-4" />
            <Badge className="absolute -top-0.5 -right-0.5 size-4 p-0 flex items-center justify-center text-[10px] bg-emerald-500 text-white border-0 rounded-full">
              3
            </Badge>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="hidden sm:flex size-9">
            <Settings className="size-4" />
          </Button>

          {/* Doctor avatar */}
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                DS
              </AvatarFallback>
            </Avatar>
            <span className="hidden lg:inline text-sm font-medium text-foreground">
              Dr. Sugandha
            </span>
          </div>
        </div>
      </div>

      {/* Selected study info bar */}
      {selectedStudy && (
        <>
          <Separator />
          <div className="px-3 md:px-6 py-2 bg-emerald-50/50 border-b border-emerald-100/50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="size-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {selectedStudy.patient?.name ?? 'Unknown Patient'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedStudy.patient?.age}y {selectedStudy.patient?.sex}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  UHID: {selectedStudy.patient?.uhid ?? '—'}
                </span>
                {studyTypeMeta && (
                  <Badge variant="secondary" className={`${studyTypeMeta.color} text-xs border-0`}>
                    {studyTypeMeta.label}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className={`${STATUS_COLORS[selectedStudy.status] ?? ''} text-xs border-0`}
                >
                  {STATUS_LABELS[selectedStudy.status] ?? selectedStudy.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  <span className="hidden sm:inline">{formatDate(selectedStudy.studyDate)}</span>
                </div>
                {selectedStudy.patient?.referringDoctor && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Stethoscope className="size-3.5" />
                    <span className="hidden sm:inline">{selectedStudy.patient.referringDoctor}</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setSelectedStudy(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}