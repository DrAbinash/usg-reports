'use client';

import { useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Printer,
  ShieldAlert,
  FileText,
  User,
  Calendar,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUsgStore } from '@/store/usg-store';

function FormField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className || ''}`}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function PcpndtForm() {
  const { pcpndtData, updatePcpndtData, selectedStudy, setActiveView } = useUsgStore();

  const formStatusVariant = useMemo(() => {
    switch (pcpndtData.formStatus) {
      case 'draft':
        return { label: 'Draft', className: 'bg-amber-100 text-amber-700' };
      case 'saved':
        return { label: 'Saved', className: 'bg-emerald-100 text-emerald-700' };
      case 'submitted':
        return { label: 'Submitted', className: 'bg-teal-100 text-teal-700' };
      default:
        return { label: 'Draft', className: 'bg-amber-100 text-amber-700' };
    }
  }, [pcpndtData.formStatus]);

  const handleSave = () => {
    updatePcpndtData({ formStatus: 'saved' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('study')}
            aria-label="Back to study"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PCPNDT Form F
              </h1>
              <Badge variant="outline" className={formStatusVariant.className}>
                {formStatusVariant.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {pcpndtData.formNumber || 'PCPNDT-2025-00000'}
              {selectedStudy?.patient && ` — ${selectedStudy.patient.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" />
            Print Form
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleSave}>
            <Save className="size-4" />
            Save Form
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 1 — Patient Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-teal-600" />
              Patient Information
            </CardTitle>
            <CardDescription>Patient and husband details for PCPNDT compliance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Patient Name" htmlFor="pcp-patient-name">
              <Input
                id="pcp-patient-name"
                value={pcpndtData.patientName || ''}
                onChange={(e) => updatePcpndtData({ patientName: e.target.value })}
                placeholder="Patient name"
              />
            </FormField>

            <FormField label="Patient Age" htmlFor="pcp-patient-age">
              <Input
                id="pcp-patient-age"
                type="number"
                value={pcpndtData.patientAge ?? ''}
                onChange={(e) => updatePcpndtData({ patientAge: Number(e.target.value) || undefined })}
                placeholder="Age in years"
              />
            </FormField>

            <FormField label="Husband's Name" htmlFor="pcp-husband-name">
              <Input
                id="pcp-husband-name"
                value={pcpndtData.husbandName || ''}
                onChange={(e) => updatePcpndtData({ husbandName: e.target.value })}
                placeholder="Husband's full name"
              />
            </FormField>

            <FormField label="Husband's Age" htmlFor="pcp-husband-age">
              <Input
                id="pcp-husband-age"
                type="number"
                value={pcpndtData.husbandAge ?? ''}
                onChange={(e) => updatePcpndtData({ husbandAge: Number(e.target.value) || undefined })}
                placeholder="Age in years"
              />
            </FormField>

            <FormField label="Husband's Address" htmlFor="pcp-husband-address" className="sm:col-span-2">
              <Textarea
                id="pcp-husband-address"
                value={pcpndtData.husbandAddress || ''}
                onChange={(e) => updatePcpndtData({ husbandAddress: e.target.value })}
                placeholder="Full address"
                rows={2}
              />
            </FormField>

            <FormField label="Referring Doctor" htmlFor="pcp-referral" className="sm:col-span-2">
              <Input
                id="pcp-referral"
                value={pcpndtData.referral || ''}
                onChange={(e) => updatePcpndtData({ referral: e.target.value })}
                placeholder="Referring doctor name"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Section 2 — Obstetric History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4 text-teal-600" />
              Obstetric History
            </CardTitle>
            <CardDescription>LMP, EDD, gestational age and obstetric summary</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="LMP Date" htmlFor="pcp-lmp">
              <Input
                id="pcp-lmp"
                type="date"
                value={pcpndtData.lmp || ''}
                onChange={(e) => updatePcpndtData({ lmp: e.target.value })}
              />
            </FormField>

            <FormField label="EDD (Expected Date of Delivery)" htmlFor="pcp-edd">
              <Input
                id="pcp-edd"
                type="date"
                value={pcpndtData.edd || ''}
                onChange={(e) => updatePcpndtData({ edd: e.target.value })}
              />
            </FormField>

            <FormField label="Current Gestational Age" htmlFor="pcp-ga">
              <Input
                id="pcp-ga"
                value={pcpndtData.currentGa || ''}
                onChange={(e) => updatePcpndtData({ currentGa: e.target.value })}
                placeholder="e.g., 32w2d"
              />
            </FormField>

            <Separator className="sm:col-span-2 my-1" />

            <FormField label="Gravida" htmlFor="pcp-gravida">
              <Input
                id="pcp-gravida"
                type="number"
                min={0}
                value={pcpndtData.gravida ?? ''}
                onChange={(e) => updatePcpndtData({ gravida: Number(e.target.value) || undefined })}
                placeholder="Number of pregnancies"
              />
            </FormField>

            <FormField label="Para" htmlFor="pcp-para">
              <Input
                id="pcp-para"
                type="number"
                min={0}
                value={pcpndtData.para ?? ''}
                onChange={(e) => updatePcpndtData({ para: Number(e.target.value) || undefined })}
                placeholder="Number of deliveries"
              />
            </FormField>

            <FormField label="Living" htmlFor="pcp-living">
              <Input
                id="pcp-living"
                type="number"
                min={0}
                value={pcpndtData.living ?? ''}
                onChange={(e) => updatePcpndtData({ living: Number(e.target.value) || undefined })}
                placeholder="Living children"
              />
            </FormField>

            <FormField label="Abortion" htmlFor="pcp-abortion">
              <Input
                id="pcp-abortion"
                type="number"
                min={0}
                value={pcpndtData.abortion ?? ''}
                onChange={(e) => updatePcpndtData({ abortion: Number(e.target.value) || undefined })}
                placeholder="Number of abortions"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Section 3 — Previous USG */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-teal-600" />
              Previous USG
            </CardTitle>
            <CardDescription>Details of any prior ultrasound examinations</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Previous USG Done" htmlFor="pcp-prev-usg" className="sm:col-span-2">
              <Select
                value={pcpndtData.previousUsg?.startsWith('Yes') ? 'yes' : pcpndtData.previousUsg?.startsWith('No') ? 'no' : 'no'}
                onValueChange={(v) => {
                  if (v === 'yes') {
                    updatePcpndtData({ previousUsg: 'Yes' });
                  } else {
                    updatePcpndtData({ previousUsg: 'No', previousUsgDate: '', previousGa: '' });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Previous USG Date" htmlFor="pcp-prev-date">
              <Input
                id="pcp-prev-date"
                type="date"
                value={pcpndtData.previousUsgDate || ''}
                onChange={(e) => updatePcpndtData({ previousUsgDate: e.target.value })}
                disabled={pcpndtData.previousUsg?.startsWith('No')}
              />
            </FormField>

            <FormField label="Previous GA at Scan" htmlFor="pcp-prev-ga">
              <Input
                id="pcp-prev-ga"
                value={pcpndtData.previousGa || ''}
                onChange={(e) => updatePcpndtData({ previousGa: e.target.value })}
                placeholder="e.g., 28w0d"
                disabled={pcpndtData.previousUsg?.startsWith('No')}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Section 4 — Current Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="size-4 text-teal-600" />
              Current Findings
            </CardTitle>
            <CardDescription>Ultrasonography findings and impression</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Findings" htmlFor="pcp-findings">
              <Textarea
                id="pcp-findings"
                value={pcpndtData.findings || ''}
                onChange={(e) => updatePcpndtData({ findings: e.target.value })}
                placeholder="Enter ultrasound findings..."
                rows={4}
              />
            </FormField>

            <FormField label="Impression" htmlFor="pcp-impression">
              <Textarea
                id="pcp-impression"
                value={pcpndtData.impression || ''}
                onChange={(e) => updatePcpndtData({ impression: e.target.value })}
                placeholder="Enter impression / diagnosis..."
                rows={4}
              />
            </FormField>
          </CardContent>
        </Card>
      </div>

      {/* Section 5 — Sex Determination (CRITICAL) */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <ShieldAlert className="size-4" />
            Sex Determination
          </CardTitle>
          <CardDescription className="text-red-600/80">
            Mandatory declaration as per the Pre-Conception and Pre-Natal Diagnostic Techniques (PCPNDT) Act, 1994
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <FormField label="Sex Determined" htmlFor="pcp-sex">
              <Select
                value={pcpndtData.sexDetermined || 'NOT DETERMINED'}
                onValueChange={(v) => updatePcpndtData({ sexDetermined: v })}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT DETERMINED">NOT DETERMINED</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <Alert variant="destructive" className="border-red-300 bg-red-100 dark:bg-red-950/50">
              <AlertTriangle className="size-4" />
              <AlertTitle className="font-bold text-red-800 dark:text-red-300">
                Legal Warning — PCPNDT Act
              </AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-400">
                As per the PCPNDT Act, 1994 (as amended), sex determination is <strong>strictly prohibited</strong>. 
                Pre-natal diagnostic techniques shall not be used to determine the sex of the fetus. 
                This field <strong>must remain &quot;NOT DETERMINED&quot;</strong>. Any violation is a 
                cognizable and non-bailable offence punishable with imprisonment up to 5 years and fine up to ₹5,00,000.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <FileText className="size-4" />
          <span>
            Form: <span className="font-mono font-medium text-foreground">{pcpndtData.formNumber || 'PCPNDT-2025-00000'}</span>
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span>
            Date: <span className="font-medium text-foreground">{pcpndtData.formDate || new Date().toISOString().split('T')[0]}</span>
          </span>
          <Separator orientation="vertical" className="h-4" />
          <Badge variant="outline" className={formStatusVariant.className}>
            {formStatusVariant.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="size-4" />
            Print Form
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave}>
            <Save className="size-4" />
            Save Form
          </Button>
        </div>
      </div>
    </div>
  );
}