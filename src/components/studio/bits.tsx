"use client";
/** Shared layout bits for the USG studio shell. */
import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[10px] font-semibold uppercase tracking-[0.12em] text-faint", className)}>{children}</div>;
}
