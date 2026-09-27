/**
 * Line/sentence-level bolding for abnormal organ findings.
 *
 * When a pathology chip is selected, the organ section is marked abnormal —
 * but only the sentences that actually state the abnormality should print
 * bold. Neutral scaffold / measurement lines ("Liver measures … cm.") stay
 * regular weight.
 */

/** Collapse tokens / blanks so pathology text can be compared to the organ normal. */
export function normalizeFindingSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/_+/g, " ")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/[^\w\s#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pure size / caliber lines that do not themselves assert disease.
 * "Liver is enlarged and measures …" is NOT neutral (contains enlarged).
 */
export function isNeutralMeasurementSentence(sentence: string): boolean {
  const t = sentence.trim();
  if (!/\bmeasures?\b/i.test(t)) return false;
  if (
    /\b(enlarged|reduced|dilated|increased|decreased|coarse|fatty|abscess|lesion|mass|cyst|calcul\w*|stone|grade\s*[ivx0-9]|hypoechoic|hyperechoic|heterogeneous|attenuation|blurring|thromb\w*|collection)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

/** Split a paragraph into sentences, keeping trailing whitespace on each piece.
 *  Decimal measurements (`14.8 cm`) must not be treated as sentence boundaries. */
export function splitFindingSentences(paragraph: string): string[] {
  if (!paragraph) return [];
  // Shield digit.digit so "14.8 cm" stays one sentence.
  const shielded: string[] = [];
  const protectedText = paragraph.replace(/(\d)\.(\d)/g, (_, a: string, b: string) => {
    const token = `\uE000${shielded.length}\uE001`;
    shielded.push(`${a}.${b}`);
    return token;
  });
  const parts = protectedText.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
  if (!parts || !parts.length) return paragraph.trim() ? [paragraph] : [];
  return parts.map((p) =>
    p.replace(/\uE000(\d+)\uE001/g, (_, i: string) => shielded[Number(i)] ?? ""),
  );
}

function baselineNormals(normalText: string): Set<string> {
  const set = new Set<string>();
  for (const para of normalText.split(/\n+/)) {
    for (const raw of splitFindingSentences(para)) {
      const n = normalizeFindingSentence(raw);
      if (n) set.add(n);
    }
  }
  return set;
}

/** True when this sentence is scaffold/normal and should NOT print bold. */
export function isBaselineFindingSentence(sentence: string, normalText: string): boolean {
  const core = sentence.trim();
  if (!core) return true;
  const norms = baselineNormals(normalText);
  const n = normalizeFindingSentence(core);
  if (n && norms.has(n)) return true;
  if (isNeutralMeasurementSentence(core)) return true;
  return false;
}

export type FindingSegment = {
  /** Sentence text including its trailing whitespace. */
  text: string;
  bold: boolean;
};

/**
 * Segment organ finding text into bold vs regular pieces.
 * Paragraph breaks (`\n+`) are preserved as segments with text "\n".
 */
export function segmentAbnormalFindings(text: string, normalText: string): FindingSegment[] {
  if (!text) return [];
  const out: FindingSegment[] = [];
  const paras = text.split(/(\n+)/);
  for (const chunk of paras) {
    if (!chunk) continue;
    if (/^\n+$/.test(chunk)) {
      out.push({ text: chunk, bold: false });
      continue;
    }
    for (const raw of splitFindingSentences(chunk)) {
      const trimmed = raw.trim();
      if (!trimmed) {
        out.push({ text: raw, bold: false });
        continue;
      }
      out.push({ text: raw, bold: !isBaselineFindingSentence(raw, normalText) });
    }
  }
  return out;
}

/** Escape for HTML text nodes (matches print.ts esc, incl. apostrophe). */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML for an organ finding body.
 * When `abnormal` is false, the whole text is escaped (no bold).
 * When true, only non-baseline sentences are wrapped in `<strong>`.
 */
export function formatFindingsBodyHtml(
  text: string,
  opts: { abnormal?: boolean; normalText?: string } = {},
): string {
  if (!opts.abnormal) {
    return esc(text).replace(/\n/g, "<br/>");
  }
  const segs = segmentAbnormalFindings(text, opts.normalText ?? "");
  return segs
    .map((s) => {
      if (/^\n+$/.test(s.text)) return s.text.replace(/\n/g, "<br/>");
      const core = s.text;
      // Preserve leading/trailing whitespace outside <strong>
      const m = core.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!m) return esc(core);
      const [, lead, mid, trail] = m;
      if (!mid) return esc(core);
      if (s.bold) return `${lead}<strong>${esc(mid)}</strong>${trail}`;
      return esc(core);
    })
    .join("");
}
