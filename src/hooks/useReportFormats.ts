/**
 * Shared hydration for report formats (UsgReportTemplate).
 * Toolbar chips + Formats Library dialog MUST use this same query key.
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export type HydratedReportFormat = {
  id: string;
  name: string;
  studyKey: string;
  stateJson: string;
  pinned: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  studyType: string;
  category: string;
  searchAliases: string[];
  organKeywords: string[];
};

export const REPORT_FORMATS_QUERY_KEY = ["usg", "reportFormats"] as const;

async function fetchReportFormats(): Promise<HydratedReportFormat[]> {
  const res = await fetch("/api/usg/templates");
  if (!res.ok) throw new Error(`templates ${res.status}`);
  const d = (await res.json()) as { templates: HydratedReportFormat[] };
  return d.templates ?? [];
}

/** Hydrated report-formats collection (same source for chips + Formats Library). */
export function useReportFormats() {
  const q = useQuery({
    queryKey: REPORT_FORMATS_QUERY_KEY,
    queryFn: fetchReportFormats,
    staleTime: 30_000,
  });
  return {
    formats: q.data ?? [],
    isLoading: q.isLoading || (q.isFetching && !q.data),
    isPending: q.isPending,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useInvalidateReportFormats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: REPORT_FORMATS_QUERY_KEY });
}
