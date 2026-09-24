/**
 * Repeatable-row (grid) organ engine — BPP first.
 *
 * Grid organs store structured `rows[]` on UsgOrganState. Total scores are
 * always DERIVED at read/print time — never persisted in cells.
 */
import type {
  UsgGridColumn,
  UsgGridFixedRow,
  UsgGridRow,
  UsgGridSchema,
  UsgOrganDef,
  UsgOrganState,
} from "./types";

/** BPP clinical criteria — fixed 5-component biophysical profile. */
export const BPP_FIXED_ROWS: UsgGridFixedRow[] = [
  {
    id: "breathing",
    label: "Fetal breathing movement",
    normalDesc:
      "At least 30 seconds of sustained breathing in 30 minutes of observation.",
    abnormalDesc: "Fetal breathing movement is < 30 seconds of observation in 30 minutes.",
  },
  {
    id: "movements",
    label: "Fetal movements",
    normalDesc: "3 or more in 30 minutes, Simultaneous limb and trunk movement.",
    abnormalDesc: "2 or less movements in 30 minutes.",
  },
  {
    id: "tone",
    label: "Fetal tone",
    normalDesc:
      "1 episode of motion of limb from flexion to extension and rapid return to flexion.",
    abnormalDesc: "Fetus in semi or full limb extension with no return or slow return to flexion.",
  },
  {
    id: "nst",
    label: "Fetal reactivity (non stress CTG)",
    normalDesc:
      "2 or more accelerations of at least 15 beats / minute lasting at least 15 seconds and associated with fetal movements.",
    abnormalDesc: "No accelerations or less than 2 in 20 minutes of observation.",
  },
  {
    id: "afv",
    label: "Amniotic fluid volume",
    normalDesc: "Pocket of at least 1 cm in 2 perpendicular planes.",
    abnormalDesc: "Largest pocket < 1cm in 2 perpendicular planes.",
  },
];

export const BPP_SCORE_OPTIONS = [
  { value: "2", label: "2" },
  { value: "0", label: "0" },
] as const;

export const BPP_GRID_COLUMNS: UsgGridColumn[] = [
  { key: "variable", label: "Variable", type: "text" },
  {
    key: "score",
    label: "Score",
    type: "select",
    options: [...BPP_SCORE_OPTIONS],
  },
];

/** Shared BPP grid schema (single + twin organs). */
export const BPP_GRID_SCHEMA: UsgGridSchema = {
  columns: BPP_GRID_COLUMNS,
  fixedRows: BPP_FIXED_ROWS,
  scoreTotal: { columnKey: "score", max: 10 },
};

/** Default BPP rows — scores start at 2 (normal). */
export function defaultBppRows(): UsgGridRow[] {
  return BPP_FIXED_ROWS.map((r) => ({
    id: r.id,
    cells: { variable: r.label, score: "2" },
  }));
}

/** Sum of numeric score cells — DERIVED, never stored. */
export function deriveGridScoreTotal(
  rows: UsgGridRow[] | undefined,
  scoreKey = "score",
): number {
  if (!rows?.length) return 0;
  let total = 0;
  for (const row of rows) {
    const n = Number(row.cells[scoreKey]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export function isGridOrgan(def: Pick<UsgOrganDef, "kind" | "grid">): boolean {
  return def.kind === "grid" && !!def.grid;
}

/** True when a grid organ still has only legacy prose (no structured rows). */
export function isLegacyGridState(
  def: Pick<UsgOrganDef, "kind" | "grid">,
  state: Pick<UsgOrganState, "rows" | "text">,
): boolean {
  if (!isGridOrgan(def)) return false;
  if (Array.isArray(state.rows) && state.rows.length > 0) return false;
  return !!(state.text && state.text.trim());
}

/**
 * Coerce incoming rows to the schema's fixed row set (BPP) or pass through
 * free-form rows. Unknown cells kept; missing score defaults to "".
 */
export function coerceGridRows(
  schema: UsgGridSchema,
  incoming: unknown,
): UsgGridRow[] {
  const raw = Array.isArray(incoming) ? incoming : [];
  const byId = new Map<string, UsgGridRow>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Partial<UsgGridRow>;
    const id = typeof o.id === "string" && o.id ? o.id : "";
    if (!id) continue;
    const cells: Record<string, string> = {};
    if (o.cells && typeof o.cells === "object") {
      for (const [k, v] of Object.entries(o.cells)) {
        if (typeof v === "string") cells[k] = v;
        else if (v != null) cells[k] = String(v);
      }
    }
    byId.set(id, { id, cells });
  }

  if (schema.fixedRows?.length) {
    return schema.fixedRows.map((fr) => {
      const prev = byId.get(fr.id);
      const cells: Record<string, string> = { ...(prev?.cells ?? {}) };
      if (!cells.variable) cells.variable = fr.label;
      for (const col of schema.columns) {
        if (cells[col.key] == null) cells[col.key] = col.key === "variable" ? fr.label : "";
      }
      return { id: fr.id, cells };
    });
  }

  return [...byId.values()];
}

/** Seed default rows for a fresh grid organ. */
export function initialGridRows(def: UsgOrganDef): UsgGridRow[] | undefined {
  if (!def.grid) return undefined;
  if (def.grid.fixedRows === BPP_FIXED_ROWS || def.grid.scoreTotal?.max === 10) {
    // BPP family — use clinical defaults (all 2s).
    if (def.grid.fixedRows?.some((r) => r.id === "breathing")) {
      return defaultBppRows();
    }
  }
  if (def.grid.fixedRows?.length) {
    return def.grid.fixedRows.map((fr) => ({
      id: fr.id,
      cells: Object.fromEntries(
        def.grid!.columns.map((c) => [c.key, c.key === "variable" ? fr.label : ""]),
      ),
    }));
  }
  return [];
}

/** Prose fallback used when printing a grid with scores (also for impression snippets). */
export function gridRowsToProse(def: UsgOrganDef, rows: UsgGridRow[]): string {
  if (!def.grid) return "";
  const lines = rows.map((r) => {
    const label = r.cells.variable || def.grid!.fixedRows?.find((f) => f.id === r.id)?.label || r.id;
    const score = r.cells.score ?? "";
    return `${label}: ${score}`;
  });
  if (def.grid.scoreTotal) {
    const total = deriveGridScoreTotal(rows, def.grid.scoreTotal.columnKey);
    lines.push(`Total Score: ${total}/${def.grid.scoreTotal.max}`);
  }
  return lines.join(". ");
}

/** Patch one cell on an organ's rows (immutable). */
export function setGridCell(
  state: UsgOrganState,
  rowId: string,
  columnKey: string,
  value: string,
): UsgOrganState {
  const rows = (state.rows ?? []).map((r) =>
    r.id === rowId ? { ...r, cells: { ...r.cells, [columnKey]: value } } : r,
  );
  return { ...state, rows, custom: true };
}
