"use client";
/**
 * Voice-to-text (dictation) — Web Speech API, Chrome/Edge.
 * Used on Findings, Impression, Technique and Recommendation.
 * Needs a secure context: HTTPS (Tailscale) or localhost — the button
 * explains itself honestly when the browser says no.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Minimal typings — SpeechRecognition is not in lib.dom yet.
type SRAlternative = { transcript: string; confidence: number };
type SRResult = { isFinal: boolean; length: number; 0: SRAlternative };
type SREvent = { resultIndex: number; results: { length: number } & Record<number, SRResult> };
type SRInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SRCtor = new () => SRInstance;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return getSRCtor() !== null;
}

/** Tidy a dictated chunk: collapse spaces, fix punctuation spacing, capitalize. */
function tidy(text: string): string {
  let t = text.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

/**
 * Live dictation. `onFinal` fires with each completed chunk —
 * callers append it to their field state (autosave handles the rest).
 */
export function useDictation(onFinal: (chunk: string) => void, label = "field") {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SRInstance | null>(null);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      toast.error("Voice needs Chrome or Edge (mic permission). Use HTTPS / Tailscale on the LAN.");
      return;
    }
    if (recRef.current) {
      stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const chunk = tidy(res[0].transcript);
        if (res.isFinal) {
          if (chunk) finalRef.current(chunk);
        } else {
          interimText += chunk + " ";
        }
      }
      setInterim(interimText.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone blocked. Allow the mic, and use HTTPS (Tailscale) or localhost.");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Dictation error: ${e.error}`);
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      toast.error(`Could not start dictation for the ${label}.`);
    }
  }, [label, stop]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { listening, interim, start, stop };
}

/** Round mic button for a field header. Red pulse while listening. */
export function MicButton({
  onFinal,
  label,
  className,
}: {
  onFinal: (chunk: string) => void;
  label?: string;
  className?: string;
}) {
  const { listening, start } = useDictation(onFinal, label);
  if (!dictationSupported()) {
    return (
      <span
        className={cn("flex h-6 w-6 items-center justify-center rounded-full bg-muted text-faint", className)}
        title="Voice needs Chrome/Edge over HTTPS or localhost"
      >
        <MicOff className="h-3 w-3" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      data-testid="mic-button"
      aria-label={listening ? "Stop dictation" : "Dictate"}
      title={listening ? "Listening — tap to stop" : "Dictate (voice to text)"}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full transition-all",
        listening
          ? "bg-destructive text-white shadow-md ring-2 ring-destructive/30 animate-pulse"
          : "bg-card text-primary ring-1 ring-border hover:bg-accent hover:ring-primary/40",
        className,
      )}
    >
      {listening ? <Square className="h-2.5 w-2.5 fill-current" /> : <Mic className="h-3 w-3" />}
    </button>
  );
}

/** Dictation bar for free findings: live transcript + creates a note row on stop. */
export function DictationBar({
  onFinalText,
  onCancel,
}: {
  onFinalText: (text: string) => void;
  onCancel: () => void;
}) {
  const bufferRef = useRef("");
  const [live, setLive] = useState("");
  const { listening, interim, start, stop } = useDictation((chunk) => {
    bufferRef.current = (bufferRef.current ? bufferRef.current + " " : "") + chunk;
    setLive(bufferRef.current);
  }, "finding");

  const finish = () => {
    stop();
    const text = (bufferRef.current + (interim ? " " + interim : "")).trim();
    if (text) onFinalText(text);
    else onCancel();
  };

  return (
    <div className="mb-3 rounded-lg border border-destructive/30 bg-card p-3 ring-1 ring-destructive/10">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white animate-pulse">
          <Mic className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-destructive">
          {listening ? "Listening — speak your finding…" : "Ready"}
        </span>
        <div className="ml-auto flex gap-2">
          {!listening ? (
            <button onClick={start} className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-primary-foreground">
              Start
            </button>
          ) : (
            <button onClick={finish} className="rounded-md bg-destructive px-3 py-1 text-[12px] font-semibold text-white">
              Save finding
            </button>
          )}
          <button
            onClick={() => { stop(); onCancel(); }}
            className="rounded-md border border-border bg-card px-3 py-1 text-[12px] font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="mt-2 min-h-[18px] text-[12.5px] italic leading-relaxed text-muted-foreground">
        {live || interim || "Voice appears here, then becomes a finding you can edit."}
      </p>
    </div>
  );
}
