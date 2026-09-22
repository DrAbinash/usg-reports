/**
 * Quality gate for OCR output — port of ERP's assessOcrQuality.
 * Rejects low-confidence or suspiciously short text before trusting it.
 */

export interface QualityResult {
  isGood: boolean;
  reasons: string[];
}

export function assessBiometryOcrQuality(text: string, confidence: number): QualityResult {
  const reasons: string[] = [];
  
  // Biometry tables are short — but must have at least one measurement keyword
  const keywords = ["bpd", "hc", "ac", "fl", "efw", "ga", "edd", "fhr", "afi", "placenta", "cm", "mm", "g", "bpm", "weeks"];
  const lower = text.toLowerCase();
  const hasKeyword = keywords.some((k) => lower.includes(k));
  
  if (confidence < 0.7) {
    reasons.push(`low_confidence: ${confidence.toFixed(2)}`);
  }
  if (text.length < 20) {
    reasons.push("suspiciously_short_text");
  }
  if (!hasKeyword) {
    reasons.push("no_biometry_keywords_found");
  }
  
  return {
    isGood: reasons.length === 0,
    reasons,
  };
}
