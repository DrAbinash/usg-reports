'use client';

import { useUsgStore } from '@/store/usg-store';
import CareHeader from '@/components/usg/CareHeader';
import WorklistView from '@/components/usg/WorklistView';
import ImageStrip from '@/components/usg/ImageStrip';
import MeasurementsTable from '@/components/usg/MeasurementsTable';
import ReportEditor from '@/components/usg/ReportEditor';
import AiAssistant from '@/components/usg/AiAssistant';
import ScanChecklist from '@/components/usg/ScanChecklist';
import KeyImageSelector from '@/components/usg/KeyImageSelector';
import ReportQA from '@/components/usg/ReportQA';
import DashboardView from '@/components/usg/DashboardView';
import PcpndtForm from '@/components/usg/PcpndtForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, ClipboardCheck, ShieldCheck, Images, PanelRightClose, PanelRightOpen,
  ArrowLeft, Activity, FileText,
} from 'lucide-react';

export default function Home() {
  const {
    activeView,
    selectedStudy,
    rightPanelOpen,
    setRightPanelOpen,
    activeRightTab,
    setActiveRightTab,
    setSelectedStudy,
    setActiveView,
    reportQA,
  } = useUsgStore();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40">
      <CareHeader />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ===== WORKLIST VIEW ===== */}
        {activeView === 'worklist' && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
              <WorklistView />
            </div>
          </div>
        )}

        {/* ===== STUDY WORKSPACE VIEW ===== */}
        {activeView === 'study' && selectedStudy && (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Study Top Bar */}
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur border-b border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setSelectedStudy(null);
                    setActiveView('worklist');
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Worklist</span>
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm truncate">
                    {selectedStudy.patient?.name}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {selectedStudy.patient?.uhid}
                  </Badge>
                  <Badge className="text-xs shrink-0 bg-teal-600 hover:bg-teal-700">
                    {selectedStudy.studyType}
                  </Badge>
                </div>
                <div className="flex-1" />
                <div className="hidden md:flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {selectedStudy.measurements?.length || 0} measurements
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs"
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    {selectedStudy.machine}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 lg:hidden"
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Study Content - Scrollable */}
              <div className="flex-1 overflow-auto usg-scrollbar">
                {/* Image Strip */}
                <div className="px-4 pt-3 pb-1">
                  <ImageStrip />
                </div>

                {/* Measurements + Report (2 columns on desktop) */}
                <div className="px-4 py-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <MeasurementsTable />
                  </div>
                  <div>
                    <ReportEditor />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - AI Assistant / Checklist / QA / Key Images */}
            {rightPanelOpen && (
              <div className="w-80 xl:w-96 border-l border-border/60 bg-white/90 backdrop-blur flex flex-col shrink-0 hidden md:flex">
                <Tabs
                  value={activeRightTab}
                  onValueChange={(v) => setActiveRightTab(v as typeof activeRightTab)}
                  className="flex flex-col h-full"
                >
                  <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                    <TabsTrigger
                      value="ai"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-2.5 text-xs gap-1.5"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      AI
                      {selectedStudy.aiSuggestions?.filter(s => !s.isDismissed && s.severity === 'critical').length ? (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                          {selectedStudy.aiSuggestions.filter(s => !s.isDismissed && s.severity === 'critical').length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger
                      value="checklist"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-2.5 text-xs gap-1.5"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Checklist
                    </TabsTrigger>
                    <TabsTrigger
                      value="qa"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-2.5 text-xs gap-1.5"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      QA
                      {reportQA.filter(q => q.status === 'fail' || q.status === 'critical').length > 0 ? (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                          {reportQA.filter(q => q.status === 'fail' || q.status === 'critical').length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger
                      value="keyimages"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-2.5 text-xs gap-1.5"
                    >
                      <Images className="h-3.5 w-3.5" />
                      Key
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <TabsContent value="ai" className="m-0 p-3">
                        <AiAssistant />
                      </TabsContent>
                      <TabsContent value="checklist" className="m-0 p-3">
                        <ScanChecklist />
                      </TabsContent>
                      <TabsContent value="qa" className="m-0 p-3">
                        <ReportQA />
                      </TabsContent>
                      <TabsContent value="keyimages" className="m-0 p-3">
                        <KeyImageSelector />
                      </TabsContent>
                    </ScrollArea>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        )}

        {/* ===== DASHBOARD VIEW ===== */}
        {activeView === 'dashboard' && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
              <DashboardView />
            </div>
          </div>
        )}

        {/* ===== PCPNDT VIEW ===== */}
        {activeView === 'pcpndt' && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6">
              <PcpndtForm />
            </div>
          </div>
        )}

        {/* ===== SETTINGS VIEW (placeholder) ===== */}
        {activeView === 'settings' && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6">
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setActiveView(selectedStudy ? 'study' : 'worklist')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <h1 className="text-xl font-bold">Settings</h1>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    PACS Configuration
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">PACS Server</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="192.168.1.100" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">DICOM Port</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="104" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">AE Title (SCP)</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="CARE_PACS" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">AE Title (SCU)</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="CARE_USG" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Configuration
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">AI Server</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="http://localhost:8000" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Model Version</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="usg-v2.1" readOnly />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    GE Voluson E9 Integration
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Machine IP</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="192.168.1.50" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">DICOM Port</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="104" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Auto-push Status</label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-teal" />
                        <span className="text-sm text-emerald-700 font-medium">Connected & Receiving</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Study Received</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="2025-01-15 14:00 IST" readOnly />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-3">Doctor Profile</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Doctor Name</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="Dr. Sugandha" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Registration Number</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MH-XXXXX" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Specialization</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MD Radiology / DNB" readOnly />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Signature</label>
                      <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Upload signature image" disabled />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t bg-white/80 backdrop-blur px-4 py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">CARE AI Sonologist Companion™</span>
            <span>•</span>
            <span>CARE Diagnostics</span>
          </div>
          <div className="flex items-center gap-3">
            <span>GE Voluson E9 Integrated</span>
            <span>•</span>
            <span>v1.0.0</span>
            <span>•</span>
            <span>AI assists. Doctor decides.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}