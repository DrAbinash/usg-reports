"use client";
/**
 * Mic button — toggles voice dictation for a free-text field. Recognised
 * speech appends to the field via onText (sentence-aware). Requires
 * Chrome/Edge; hidden-but-titled when unsupported so the layout is stable.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { speechSupported, startDictation, type DictationHandle } from "@/lib/usg/dictation";

export function DictationButton({
  onText,
  className,
  title = "Dictate — recognised speech appends here",
}: {
  onText: (text: string) => void;
  className?: string;
  title?: string;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const handleRef = useRef<DictationHandle | null>(null);
  const supported = speechSupported();

  useEffect(() => {
    return () => handleRef.current?.stop();
  }, []);

  if (!supported) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={cn("h-7 w-7 p-0 text-faint", className)}
        title="Voice input needs Chrome or Edge"
      >
        <MicOff className="h-3.5 w-3.5" />
      </Button>
    );
  }

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setListening(false);
    setInterim("");
  };

  const toggle = () => {
    if (listening) {
      stop();
      return;
    }
    try {
      handleRef.current = startDictation({
        lang: "en-IN",
        onFinal: (text) => {
          setInterim("");
          onText(text);
        },
        onInterim: (text) => setInterim(text),
        onEnd: () => {
          handleRef.current = null;
          setListening(false);
          setInterim("");
        },
        onError: (msg) => {
          toast.error(msg);
          stop();
        },
      });
      setListening(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice input failed to start");
    }
  };

  return (
    <span className="relative inline-flex" title={interim ? `Hearing: ${interim}` : title}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className={cn(
          "h-7 w-7 p-0",
          listening ? "animate-pulse text-rose-600 hover:text-rose-700" : "text-muted-foreground hover:text-rose-600",
          className,
        )}
      >
        {listening ? <Volume2 className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </Button>
      {listening ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      ) : null}
    </span>
  );
}
