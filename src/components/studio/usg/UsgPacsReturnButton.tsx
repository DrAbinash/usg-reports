"use client";
/**
 * UsgPacsReturnButton — push a finalized report to Orthanc PACS.
 *
 * Shows a "Return to PACS" button on finalized reports that have a
 * linked StudyInstanceUID. Before pushing, checks eligibility
 * (fail-closed). Shows the Orthanc instance ID on success.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UploadCloud, CheckCircle2, Loader2, CloudUpload } from "lucide-react";

export type UsgPacsReturnButtonProps = {
  reportId: string;
  disabled?: boolean;
  /** Called after successful upload to refresh the UI. */
  onReturned?: (orthancInstanceId: string) => void;
};

export function UsgPacsReturnButton({
  reportId, disabled, onReturned,
}: UsgPacsReturnButtonProps) {
  const [loading, setLoading] = useState(false);
  const [returned, setReturned] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);

  const handlePush = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usg/reports/${reportId}/pacs-return`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setReturned(true);
        setInstanceId(data.orthancInstanceId);
        toast.success("Report uploaded to PACS");
        onReturned?.(data.orthancInstanceId);
      } else {
        const reasons = data.reasons ? ` (${data.reasons.join(", ")})` : "";
        toast.error(data.error || "PACS return failed", {
          description: reasons || undefined,
        });
      }
    } catch {
      toast.error("Network error — could not reach Orthanc");
    } finally {
      setLoading(false);
    }
  };

  if (returned) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Returned to PACS</span>
        {instanceId && (
          <code className="text-[10px] text-muted-foreground ml-1">
            {instanceId.slice(0, 12)}
          </code>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5 text-xs h-7")}
      disabled={disabled || loading}
      onClick={handlePush}
      title="Push this report to Orthanc as a DICOM SR"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudUpload className="h-3.5 w-3.5" />
      )}
      {loading ? "Uploading…" : "Return to PACS"}
    </Button>
  );
}
