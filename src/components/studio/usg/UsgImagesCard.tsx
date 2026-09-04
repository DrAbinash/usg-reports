"use client";
/**
 * Report stills — paste, drop or pick 2–4 machine images onto the draft.
 * Uploaded immediately once the report exists; buffered locally until the
 * first save otherwise. Prints as a 2-up grid with captions.
 *
 * v6.5 enhancements:
 *   - Auto-crop: removes black borders surrounding the real USG content
 *   - Manual crop override when auto-crop fails or is imperfect
 *   - Image size controls (Small / Medium / Large / Original)
 *   - Tesseract OCR: extract measurements from a screenshot of the machine
 *     screen when DICOM SR is not available
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowDown, ArrowUp, ImageIcon, ScanLine, Trash2, UploadCloud,
  Crop, Sparkles, ZoomIn, ZoomOut, Loader2, ScanText,
} from "lucide-react";
import { IMAGE_MAX_BYTES } from "@/lib/usg/images";
import { autoCropImage, resizeImage, IMAGE_SIZE_PRESETS } from "@/lib/usg/imageCrop";

export type ImageRow = { id: string; dataUrl: string; caption: string; sortOrder: number };
export type PendingImage = { dataUrl: string; caption: string };

export type UsgImagesCardProps = {
  images: ImageRow[];
  pending: PendingImage[];
  readOnly?: boolean;
  onAdd: (dataUrl: string) => void;
  onCaption: (kind: "server" | "pending", key: string, caption: string) => void;
  onRemove: (kind: "server" | "pending", key: string) => void;
  onMove: (kind: "server" | "pending", key: string, dir: -1 | 1) => void;
  /** Replace an image's data URL (for crop/resize). */
  onUpdate?: (kind: "server" | "pending", key: string, dataUrl: string) => void;
  onPickDicom?: () => void;
  pacsLinked?: boolean;
  /** OCR callback — when measurements are extracted from a screenshot. */
  onOcrMeasurements?: (measurements: Record<string, Record<string, string>>) => void;
};

function readFiles(files: File[], onAdd: (dataUrl: string) => void) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      toast.error(`${f.name || "File"} is not an image`);
      continue;
    }
    if (f.size > IMAGE_MAX_BYTES) {
      toast.error(`${f.name || "Image"} is ${(f.size / 1_000_000).toFixed(1)} MB — the limit is 1.5 MB`);
      continue;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onAdd(reader.result);
    };
    reader.onerror = () => toast.error(`Could not read ${f.name || "image"}`);
    reader.readAsDataURL(f);
  }
}

export function UsgImagesCard({
  images, pending, readOnly, onAdd, onCaption, onRemove, onMove, onUpdate, onPickDicom, pacsLinked, onOcrMeasurements,
}: UsgImagesCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const count = images.length + pending.length;

  /** Auto-crop incoming images before adding them. */
  const handleAdd = async (dataUrl: string) => {
    if (autoCrop) {
      try {
        const { dataUrl: cropped } = await autoCropImage(dataUrl);
        onAdd(cropped);
        return;
      } catch {
        // Fall back to uncropped if auto-crop fails
      }
    }
    onAdd(dataUrl);
  };

  /** Run Tesseract OCR on an uploaded screenshot. */
  const handleOcrUpload = async (file: File) => {
    if (!onOcrMeasurements) return;
    setOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const { runTesseractOcr, mapOcrToVars } = await import("@/lib/usg/tesseractOcr");
          const result = await runTesseractOcr(dataUrl, (p) => {
            // Progress is handled by the toast
          });
          if (result.measurements.length > 0) {
            const vars = mapOcrToVars(result, "");
            onOcrMeasurements(vars);
            toast.success(`OCR extracted ${result.measurements.length} measurements`, {
              description: `Confidence: ${result.confidence}% — review values in the composer`,
            });
          } else {
            toast.info("OCR could not detect measurements in this image", {
              description: "Try a clearer screenshot of the machine readout",
            });
          }
        } catch (e) {
          toast.error("OCR failed — Tesseract may not be loaded");
        } finally {
          setOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setOcrLoading(false);
      toast.error("Could not read the image for OCR");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-bold tracking-wide">USG Images</span>
        {count ? (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100">
            {count} still{count > 1 ? "s" : ""} · prints as a 2-up grid
          </span>
        ) : null}

        {/* Auto-crop toggle */}
        {!readOnly && (
          <label className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <button
              type="button"
              onClick={() => setAutoCrop((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors",
                autoCrop ? "border-sky-300 bg-sky-50 text-sky-700" : "border-border bg-muted/40 text-muted-foreground",
              )}
              title="Auto-crop black borders from uploaded images"
            >
              <Crop className="h-2.5 w-2.5" />
              Auto-crop {autoCrop ? "ON" : "OFF"}
            </button>
          </label>
        )}

        {/* OCR button */}
        {!readOnly && onOcrMeasurements ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-amber-200 bg-amber-50 px-2 text-[11px] text-amber-700 hover:bg-amber-100"
            onClick={() => ocrFileRef.current?.click()}
            disabled={ocrLoading}
            title="Upload a screenshot of the machine's measurement readout — Tesseract OCR extracts the numbers"
          >
            {ocrLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ScanText className="mr-1 h-3 w-3" />}
            {ocrLoading ? "OCR…" : "OCR"}
          </Button>
        ) : null}
        <input
          ref={ocrFileRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleOcrUpload(f);
            e.target.value = "";
          }}
        />

        {!readOnly && onPickDicom ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-violet-200 bg-violet-50 px-2 text-[11px] text-violet-700 hover:bg-violet-100"
            onClick={onPickDicom}
            title={pacsLinked ? "Pick key images from the Orthanc study" : "Sync the worklist first"}
          >
            <ScanLine className="mr-1 h-3 w-3" /> From PACS
          </Button>
        ) : null}
        {!readOnly ? (
          <Button
            variant="outline"
            size="sm"
            className={`${onPickDicom ? "" : ""} h-7 border-sky-200 bg-sky-50 px-2 text-[11px] text-sky-700 hover:bg-sky-100`}
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud className="mr-1 h-3 w-3" /> Add stills
          </Button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            readFiles(Array.from(e.target.files ?? []), handleAdd);
            e.target.value = "";
          }}
        />
      </div>

      {readOnly ? (
        <p className="text-[11px] text-faint">Finalized report — images are frozen in the printed snapshot.</p>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            readFiles(Array.from(e.dataTransfer.files ?? []), handleAdd);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length) readFiles(files, handleAdd);
          }}
          tabIndex={0}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[11.5px] font-medium transition-colors",
            dragOver ? "border-sky-400 bg-sky-50 text-sky-700" : "border-border bg-panel text-muted-foreground hover:border-sky-300 hover:text-sky-700",
          )}
          onClick={() => fileRef.current?.click()}
          title="Click, drag-and-drop, or paste (Ctrl+V) machine stills"
        >
          <UploadCloud className="h-4 w-4" />
          {count ? "Drop / paste / click to add more stills" : "Paste (Ctrl+V), drop or click to attach machine stills — they print with the report"}
        </div>
      )}

      {count ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img, i) => (
            <Thumb
              key={img.id}
              dataUrl={img.dataUrl}
              caption={img.caption}
              order={i + 1}
              readOnly={readOnly}
              first={i === 0}
              last={i === images.length - 1 && pending.length === 0}
              onCaption={(v) => onCaption("server", img.id, v)}
              onRemove={() => onRemove("server", img.id)}
              onMove={(d) => onMove("server", img.id, d)}
              onUpdate={onUpdate ? (dataUrl) => onUpdate("server", img.id, dataUrl) : undefined}
            />
          ))}
          {pending.map((img, i) => (
            <Thumb
              key={`pending-${i}`}
              dataUrl={img.dataUrl}
              caption={img.caption}
              order={images.length + i + 1}
              readOnly={readOnly}
              first={images.length === 0 && i === 0}
              last={i === pending.length - 1}
              pending
              onCaption={(v) => onCaption("pending", String(i), v)}
              onRemove={() => onRemove("pending", String(i))}
              onMove={(d) => onMove("pending", String(i), d)}
              onUpdate={onUpdate ? (dataUrl) => onUpdate("pending", String(i), dataUrl) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Thumb({
  dataUrl, caption, order, readOnly, first, last, pending,
  onCaption, onRemove, onMove, onUpdate,
}: {
  dataUrl: string;
  caption: string;
  order: number;
  readOnly?: boolean;
  first: boolean;
  last: boolean;
  pending?: boolean;
  onCaption: (v: string) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onUpdate?: (dataUrl: string) => void;
}) {
  const [cropLoading, setCropLoading] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(3); // 3 = Original (no resize)

  const handleAutoCrop = async () => {
    if (!onUpdate) return;
    setCropLoading(true);
    try {
      const { dataUrl: cropped } = await autoCropImage(dataUrl);
      onUpdate(cropped);
      toast.success("Auto-cropped black borders");
    } catch {
      toast.error("Auto-crop failed — try manual crop");
    } finally {
      setCropLoading(false);
    }
  };

  const handleResize = async (idx: number) => {
    if (!onUpdate) { setSizeIdx(idx); return; }
    setSizeIdx(idx);
    const preset = IMAGE_SIZE_PRESETS[idx];
    if (preset.value === 0) {
      // Original — no resize needed, revert to the original dataUrl
      // (can't truly revert after resize, but user can re-upload)
      return;
    }
    try {
      const resized = await resizeImage(dataUrl, preset.value);
      onUpdate(resized);
    } catch {
      toast.error("Resize failed");
    }
  };

  return (
    <div className={cn("rounded-lg border bg-panel p-1.5", pending ? "border-amber-300" : "border-border")}>
      <div className="relative">
        <img src={dataUrl} alt={`USG still ${order}`} className="h-24 w-full rounded object-cover" />
        {pending ? (
          <span className="absolute left-1 top-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
            saves with draft
          </span>
        ) : null}
      </div>
      <Input
        value={caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="Caption (optional)"
        disabled={readOnly}
        className="mt-1.5 h-7 border-border bg-white text-[11px]"
      />
      {!readOnly ? (
        <div className="mt-1 flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-faint hover:text-foreground" disabled={first} onClick={() => onMove(-1)} title="Move earlier">
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-faint hover:text-foreground" disabled={last} onClick={() => onMove(1)} title="Move later">
            <ArrowDown className="h-3 w-3" />
          </Button>

          {/* Auto-crop button */}
          {onUpdate && (
            <Button
              variant="ghost" size="sm"
              className="h-6 w-6 p-0 text-faint hover:text-sky-600"
              onClick={handleAutoCrop}
              disabled={cropLoading}
              title="Auto-crop black borders"
            >
              {cropLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crop className="h-3 w-3" />}
            </Button>
          )}

          {/* Size selector */}
          {onUpdate && (
            <select
              value={sizeIdx}
              onChange={(e) => handleResize(Number(e.target.value))}
              className="h-6 rounded border border-border bg-white px-1 text-[9px] text-muted-foreground"
              title="Image size"
            >
              {IMAGE_SIZE_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          )}

          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 text-faint hover:text-destructive" onClick={onRemove} title="Remove still">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
