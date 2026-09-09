"use client";
/**
 * UsgDoctorAutocomplete (v6.16) — autocomplete for the "Referred By" field.
 *
 * Fetches doctors from /api/usg/doctors?q=xxx as the doctor types.
 * Shows a dropdown of matching names. Selecting one fills the input.
 * Also shows a small "manage" hint linking to Settings.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export type UsgDoctorAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type DoctorMatch = {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
};

export function UsgDoctorAutocomplete({ value, onChange, disabled }: UsgDoctorAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<DoctorMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value.trim() || value.trim().length < 2) {
      setMatches([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/usg/doctors?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const d = (await res.json()) as { doctors: DoctorMatch[] };
          setMatches(d.doctors);
          setOpen(d.doctors.length > 0);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setMatches([]);
    setHighlightIdx(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      select(matches[highlightIdx].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (matches.length > 0) setOpen(true); }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Referred by"
          className="h-7 w-full rounded border border-border bg-card px-2 text-[11px] disabled:opacity-50"
        />
        {value && !disabled && (
          <button
            onClick={() => select("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
            title="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && matches.length > 0 ? (
        <div className="absolute z-50 mt-0.5 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {matches.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => select(doc.name)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors",
                i === highlightIdx ? "bg-primary/10" : "hover:bg-muted/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{doc.name}</div>
                {doc.specialization || doc.hospital ? (
                  <div className="truncate text-[9px] text-muted-foreground">
                    {[doc.specialization, doc.hospital].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <div className="absolute right-7 top-1/2 -translate-y-1/2">
          <Search className="h-3 w-3 animate-pulse text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
