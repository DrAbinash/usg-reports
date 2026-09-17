"use client";
/** Shows the active clinic's bookmarkable URL (?clinic=slug) with one-click copy. */
import { useEffect, useState } from "react";
import { Link2, Check } from "lucide-react";

export function UsgClinicLink() {
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const active = await fetch("/api/clinics/active").then(r => r.json());
        const id = active?.clinicId ?? active?.id ?? "default";
        const list = await fetch("/api/clinics").then(r => r.json());
        const me = (list?.clinics ?? []).find((c: any) => c.id === id);
        if (alive && me) setSlug(me.slug ?? me.id);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  if (!slug || slug === "default") return null;
  const url = `${window.location.origin}/?clinic=${slug}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <button
      onClick={copy}
      title={`Copy ${slug} bookmark link`}
      className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
      <span className="max-w-[150px] truncate">?clinic={slug}</span>
    </button>
  );
}
