"use client";
/**
 * USG Studio store — deliberately small (anti-soul rule: no 1,400-line monsters).
 * Auth + navigation only; report state lives in the composer.
 */
import { create } from "zustand";

export type View = "usg" | "settings";

type StudioState = {
  bootstrapped: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  view: View;

  setAuth: (v: { needsSetup: boolean; authenticated: boolean }) => void;
  setView: (v: View) => void;
};

export const useStudio = create<StudioState>((set) => ({
  bootstrapped: false,
  needsSetup: false,
  authenticated: false,
  view: "usg",

  setAuth: (v) => set({ ...v, bootstrapped: true }),
  setView: (view) => set({ view }),
}));
