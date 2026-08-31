"use client";
/**
 * Report stills — paste, drop or pick 2–4 machine images onto the draft.
 * Uploaded immediately once the report exists; buffered locally until the
 * first save otherwise. Prints as a 2-up grid with captions.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { IMAGE_MAX_BYTES } from "@/lib/usg/images";

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

export function UsgImagesCard({ images, pending, readOnly, onAdd, onCaption, onRemove, onMove }: UsgImagesCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const count = images.length + pending.length;

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
        {!readOnly ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7 border-sky-200 bg-sky-50 px-2 text-[11px] text-sky-700 hover:bg-sky-100"
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
            readFiles(Array.from(e.target.files ?? []), onAdd);
            e.target.value = "";
          }}
        />
      </div>

      {readOnly ? (
        <p className="text-[11px] text-faint">Finalized report — images are frozen in the printed snapshot.</p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            readFiles(Array.from(e.dataTransfer.files ?? []), onAdd);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length) readFiles(files, onAdd);
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
          {count
            ? "Drop / paste / click to add more stills"
            : "Paste (Ctrl+V), drop or click to attach machine stills — they print with the report"}
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Thumb({
  dataUrl, caption, order, readOnly, first, last, pending, onCaption, onRemove, onMove,
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
}) {
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
          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 text-faint hover:text-destructive" onClick={onRemove} title="Remove still">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
