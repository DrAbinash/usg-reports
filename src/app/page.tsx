"use client";
/** Single-screen studio: bootstraps auth state, routes to lock / setup / app. */
import { useEffect } from "react";
import { useStudio } from "@/lib/store";
import { SetupScreen, LockScreen } from "@/components/studio/LockScreen";
import { AppShell } from "@/components/studio/AppShell";

export default function Page() {
  const { bootstrapped, needsSetup, authenticated, setAuth } = useStudio();

  useEffect(() => {
    fetch("/api/auth/state")
      .then((r) => r.json())
      .then((d) => setAuth({ needsSetup: !!d.needsSetup, authenticated: !!d.authenticated }))
      .catch(() => setAuth({ needsSetup: false, authenticated: false }));
  }, [setAuth]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-[12px] text-faint">Opening CARE Reporting Studio…</p>
        </div>
      </div>
    );
  }

  if (needsSetup) return <SetupScreen onDone={() => setAuth({ needsSetup: false, authenticated: true })} />;
  if (!authenticated) return <LockScreen onUnlock={() => setAuth({ needsSetup: false, authenticated: true })} />;
  return <AppShell />;
}
