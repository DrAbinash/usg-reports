import { verifyPin } from "@/lib/auth";
import { DEMO_PIN } from "@/lib/seed";

/** True only when the stored PIN is still the built-in seeded number. */
export function isDemoPin(pinHash: string | null | undefined): boolean {
  return !!pinHash && verifyPin(DEMO_PIN, pinHash);
}

/**
 * The ONE rule for "this studio has not finished choosing a PIN".
 *
 * /api/auth/state shows the setup screen and /api/auth/setup writes the PIN,
 * so both must decide on the same rule. When state counted the seeded demo PIN
 * as "setup owed" while setup refused to overwrite any PIN at all, a studio
 * left on the demo number could neither be unlocked nor configured.
 */
export function isPinSetupOutstanding(pinHash: string | null | undefined): boolean {
  return !pinHash || isDemoPin(pinHash);
}
