/**
 * The demo-PIN deadlock, measured through both HTTP handlers.
 *
 * /api/auth/state decides when the setup screen is shown; /api/auth/setup
 * decides what that screen may write. They used to disagree: state counted the
 * seeded demo PIN as "setup owed", while setup refused to overwrite a PIN if
 * one existed at all. A studio still on the demo number therefore could neither
 * be unlocked nor configured — the doctor stood outside his own reports.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    // Both write a session cookie, which needs a request scope the route
    // handler has here but a bare test call does not.
    createSession: vi.fn(async () => {}),
    getSession: vi.fn(async () => false),
  };
});

import { hashPin, verifyPin } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as state } from "@/app/api/auth/state/route";
import { POST as setup } from "@/app/api/auth/setup/route";
import { DEMO_PIN } from "@/lib/seed";

const CHOSEN_PIN = "246810";
const NEW_PIN = "482913";

async function storePin(pin: string | null): Promise<void> {
  const pinHash = pin ? hashPin(pin) : "";
  await db.hospitalSettings.upsert({
    where: { id: "singleton" },
    update: { pinHash },
    create: { id: "singleton", pinHash },
  });
}

async function storedHash(): Promise<string | null> {
  const row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  return row?.pinHash ?? null;
}

async function showsSetupScreen(): Promise<boolean> {
  const body = await (await state()).json();
  return body.needsSetup === true;
}

function setupRequest(pin: string): Request {
  return new Request("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

describe("setup screen and setup route must agree", () => {
  it("lets setup replace the demo PIN that state calls unset", async () => {
    await storePin(DEMO_PIN);
    expect(await showsSetupScreen()).toBe(true);

    const res = await setup(setupRequest(NEW_PIN));

    expect(res.status).toBe(200);
    expect(verifyPin(NEW_PIN, await storedHash())).toBe(true);
  });

  it("still refuses to overwrite a PIN the doctor actually chose", async () => {
    await storePin(CHOSEN_PIN);
    expect(await showsSetupScreen()).toBe(false);

    const res = await setup(setupRequest(NEW_PIN));

    expect(res.status).toBe(400);
    expect(verifyPin(CHOSEN_PIN, await storedHash())).toBe(true);
  });

  it("accepts a first PIN on a studio that has none", async () => {
    await storePin(null);
    expect(await showsSetupScreen()).toBe(true);

    const res = await setup(setupRequest(NEW_PIN));

    expect(res.status).toBe(200);
    expect(verifyPin(NEW_PIN, await storedHash())).toBe(true);
  });

  it("never shows a setup screen that cannot save", async () => {
    for (const pin of [null, DEMO_PIN, CHOSEN_PIN]) {
      await storePin(pin);
      const shown = await showsSetupScreen();
      const saved = (await setup(setupRequest(NEW_PIN))).status === 200;
      expect(saved).toBe(shown);
    }
  });
});
