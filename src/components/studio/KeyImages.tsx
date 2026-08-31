"use client";
/**
 * Key images — the premium-report soul: images captured from the OHIF
 * viewport (or uploaded/pasted) print inside the A4 report.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "./bits";
import { DicomPicker } from "./DicomPicker";
import { Camera, Trash2, ArrowLeft, ArrowRight, Upload, Images, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type KeyImage = {
  id: string;
  dataUrl: string;
  caption: string;
  source: string;
  sortOrder: number;
};

const MAX_CHARS = 1_400_000; // client cap before compression kicks in

/** Downscale + JPEG-compress an image data URL so it stores and prints light. */
async function compressDataUrl(dataUrl: string, maxW = 1400, quality = 0.87): Promise<string> {
  if (dataUrl.length <= MAX_CHARS) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function KeyImages({
  reportId,
  images,
  finalized,
  studyInstanceUid,
  onChange,
}: {
  reportId: string;
  images: KeyImage[];
  finalized: boolean;
  studyInstanceUid?: string | null;
  onChange?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImage = async (dataUrl: string, source: "capture" | "upload") => {
    setBusy(true);
    const compressed = await compressDataUrl(dataUrl).catch(() => dataUrl);
    const r = await fetch(`/api/reports/${reportId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl: compressed, source }),
    }).then((res) => res.json()).catch(() => null);
    setBusy(false);
    if (r?.error) { toast.error(r.error); return; }
    if (r?.ok) { toast.success(source === "capture" ? "Key image captured" : "Image added"); onChange?.(); }
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files"); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    }).catch(() => null);
    if (dataUrl) await addImage(dataUrl, "upload");
  };

  const saveCaption = async (img: KeyImage, caption: string) => {
    await fetch(`/api/reports/${reportId}/images/${img.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caption }),
    });
  };

  const move = async (img: KeyImage, dir: -1 | 1) => {
    const idx = images.findIndex((i) => i.id === img.id);
    const swapWith = images[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/reports/${reportId}/images/${img.id}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/reports/${reportId}/images/${swapWith.id}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortOrder: img.sortOrder }),
      }),
    ]);
    onChange?.();
  };

  const remove = async (img: KeyImage) => {
    await fetch(`/api/reports/${reportId}/images/${img.id}`, { method: "DELETE" });
    onChange?.();
  };

  return (
    <section
      onPaste={(e) => {
        const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
        const file = item?.getAsFile();
        if (file) { e.preventDefault(); void uploadFile(file); }
      }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <SectionLabel>Key images · {images.length}</SectionLabel>
        {!finalized ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-faint">prints in the report · paste works too</span>
            <Button
              size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
              disabled={busy} onClick={() => setPickerOpen(true)}
              title="Pick images from the DICOM study (renders via Orthanc)"
            >
              <Layers className="h-3 w-3" /> From DICOM
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
              disabled={busy} onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" /> Upload
            </Button>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ""; }}
            />
          </div>
        ) : null}
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-6 text-center">
          <Images className="mx-auto h-4 w-4 text-faint" />
          <p className="mt-1.5 text-[12px] text-faint">No key images yet.</p>
          <p className="mt-0.5 text-[11px] text-faint/70">
            “From DICOM” picks images from the study · camera in the viewer captures the screen · upload / paste also work.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {images.map((img, i) => (
            <div key={img.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="relative bg-[#0e1216]">
                <img src={img.dataUrl} alt={img.caption || "Key image"} className="h-24 w-full object-contain" />
                {img.source === "capture" ? (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-[#0e1216]/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <Camera className="h-2.5 w-2.5" /> OHIF
                  </span>
                ) : null}
                {!finalized ? (
                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    <button
                      onClick={() => move(img, -1)} disabled={i === 0}
                      className="flex h-5 w-5 items-center justify-center rounded bg-[#0e1216]/80 text-white disabled:opacity-30"
                      title="Move left"
                    >
                      <ArrowLeft className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => move(img, 1)} disabled={i === images.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded bg-[#0e1216]/80 text-white disabled:opacity-30"
                      title="Move right"
                    >
                      <ArrowRight className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => remove(img)}
                      className="flex h-5 w-5 items-center justify-center rounded bg-destructive/90 text-white"
                      title="Delete"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              <Input
                defaultValue={img.caption}
                disabled={finalized}
                placeholder="Caption (printed)…"
                className={cn("h-7 rounded-none border-0 border-t border-border bg-card text-[11px] focus-visible:ring-0")}
                onBlur={(e) => { if (e.target.value !== img.caption) void saveCaption(img, e.target.value); }}
              />
            </div>
          ))}
        </div>
      )}

      <DicomPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        reportId={reportId}
        studyInstanceUid={studyInstanceUid ?? null}
        onAdded={() => onChange?.()}
      />
    </section>
  );
}
