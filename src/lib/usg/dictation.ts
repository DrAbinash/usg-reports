/**
 * USG Studio — voice dictation support (v5 phase 5).
 *
 * Web Speech API wrapper for the scan room: a mic button on free-text fields
 * (technique, findings wording, manual impression) that appends recognised
 * speech to the field. Works in Chrome/Edge; degrades gracefully elsewhere.
 * The recognition-instance plumbing is browser-only; the pure text helpers
 * are unit-testable.
 */

/** Append a recognised chunk to existing text, sentence-aware. */
export function appendTranscript(current: string, transcript: string): string {
  const t = (transcript ?? "").trim();
  if (!t) return current;
  const base = (current ?? "").trimEnd();
  if (!base) return t.charAt(0).toUpperCase() + t.slice(1);
  const joiner = /[.!?;:]$/.test(base) ? " " : base.endsWith(" ") ? "" : " ";
  const capitalised = /^[a-z]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  return `${base}${joiner}${capitalised}`;
}

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechResultEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type RecognitionCtor = new () => RecognitionLike;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!(getRecognitionCtor());
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as RecognitionCtor | undefined) ?? (w.webkitSpeechRecognition as RecognitionCtor | undefined) ?? null;
}

export type DictationHandle = { stop: () => void };

export type DictationCallbacks = {
  lang?: string; // default "en-IN"
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

/** Start continuous recognition. Returns a stop handle. Throws when unsupported. */
export function startDictation(cb: DictationCallbacks): DictationHandle {
  const Ctor = getRecognitionCtor();
  if (!Ctor) throw new Error("This browser does not support voice input (Chrome / Edge do)");
  const rec = new Ctor();
  rec.lang = cb.lang ?? "en-IN";
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0]?.transcript ?? "";
      if (r.isFinal) cb.onFinal(text);
      else interim += text;
    }
    cb.onInterim?.(interim);
  };
  rec.onerror = (e) => {
    const kind = e?.error ?? "unknown";
    cb.onError?.(
      kind === "not-allowed" || kind === "service-not-allowed"
        ? "Microphone permission was denied"
        : `Voice input error (${kind})`,
    );
  };
  rec.onend = () => cb.onEnd?.();

  rec.start();
  return { stop: () => rec.stop() };
}
