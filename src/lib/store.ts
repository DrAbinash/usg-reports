"use client";
/**
 * Studio store — deliberately small (anti-soul rule: no 1,400-line monsters).
 * Auth + navigation + worklist cache only; report detail lives in the editor.
 */
import { create } from "zustand";

export type Order = {
  id: string;
  accessionNumber: string;
  patientName: string;
  patientAge: string | null;
  patientGender: string | null;
  patientMrn: string | null;
  referringDoctor: string | null;
  testName: string | null;
  modality: string;
  bodyRegion: string;
  studyInstanceUid: string | null;
  billingStatus: string | null;
  status: string;
  ignored: boolean;
  studyDate: string | null;
  reportStatus: string | null;
  hasReport: boolean;
};

export type View = "worklist" | "reporting" | "library" | "settings";

type StudioState = {
  bootstrapped: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  view: View;
  activeOrderId: string | null;
  orders: Order[];
  search: string;
  syncedAt: string | null;
  careOk: boolean;
  orthancOk: boolean;
  lastError: string | null;
  syncing: boolean;

  setAuth: (v: { needsSetup: boolean; authenticated: boolean }) => void;
  setView: (v: View) => void;
  openReporting: (orderId: string) => void;
  setSearch: (s: string) => void;
  setWorklist: (data: { orders: Order[]; syncedAt: string | null; careOk: boolean; orthancOk: boolean; lastError: string | null }) => void;
  setSyncing: (v: boolean) => void;
};

export const useStudio = create<StudioState>((set) => ({
  bootstrapped: false,
  needsSetup: false,
  authenticated: false,
  view: "worklist",
  activeOrderId: null,
  orders: [],
  search: "",
  syncedAt: null,
  careOk: false,
  orthancOk: false,
  lastError: null,
  syncing: false,

  setAuth: (v) => set({ ...v, bootstrapped: true }),
  setView: (view) => set({ view }),
  openReporting: (orderId) => set({ activeOrderId: orderId, view: "reporting" }),
  setSearch: (search) => set({ search }),
  setWorklist: (data) => set(data),
  setSyncing: (syncing) => set({ syncing }),
}));
