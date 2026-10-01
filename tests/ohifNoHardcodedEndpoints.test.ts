/**
 * Guard: OHIF endpoints must live in configuration, never in a launch path.
 *
 * These are source-text assertions on purpose — the property being checked is
 * "no URL is constructed here", which runtime tests cannot express. Behaviour
 * is covered by tests/ohifRouting.test.ts.
 *
 * Regression this prevents: src/lib/usg/ohifLaunch.ts shipped two literals
 * (a LAN IP and a tailnet hostname) and AppShell/UsgPacsQueue built their own,
 * so a viewer move needed four code edits and AUTO silently ignored Settings.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Every path that can open the viewer. */
const LAUNCH_MODULES = [
  "src/lib/usg/ohifLaunch.ts",
  "src/lib/usg/ohifResolver.ts",
  "src/components/studio/AppShell.tsx",
  "src/components/studio/usg/UsgViewerSidebar.tsx",
  "src/components/studio/usg/UsgPacsQueue.tsx",
] as const;

/** Files that must obtain the viewer URL from the shared resolver. */
const LAUNCH_UI = [
  "src/components/studio/AppShell.tsx",
  "src/components/studio/usg/UsgViewerSidebar.tsx",
  "src/components/studio/usg/UsgPacsQueue.tsx",
] as const;

const read = (p: string): string => readFileSync(p, "utf8");

/** Strip comments — a hint explaining the old bug is not a re-enabled bug. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

describe("no hard-coded OHIF endpoints in launch paths", () => {
  it.each(LAUNCH_MODULES)("%s contains no IP-literal viewer address", (file) => {
    expect(code(read(file))).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  });

  it.each(LAUNCH_MODULES)("%s contains no tailnet (.ts.net) hostname", (file) => {
    expect(code(read(file))).not.toMatch(/\.ts\.net/i);
  });

  it("the retired hard-coded tailnet hostname is gone from the whole app", () => {
    for (const file of LAUNCH_MODULES) {
      expect(read(file)).not.toContain("tail7005c0");
    }
  });

  it("the old exported constants are gone", () => {
    const src = read("src/lib/usg/ohifLaunch.ts");
    expect(src).not.toMatch(/LAN_OHIF_BASE/);
    expect(src).not.toMatch(/TS_OHIF_BASE/);
    expect(src).not.toMatch(/PACS_OHIF_URL/);
  });

  it("no launch path assembles a /viewer URL from a literal base", () => {
    for (const file of LAUNCH_UI) {
      const src = code(read(file));
      expect(src).not.toMatch(/["'`]https?:\/\/[^"'`]*\/viewer/);
      expect(src).not.toMatch(/["'`]\/viewer\?StudyInstanceUIDs=/);
    }
  });
});

describe("every viewer launch uses the shared resolver", () => {
  it.each(LAUNCH_UI)("%s imports from the shared OHIF module", (file) => {
    expect(read(file)).toMatch(/@\/lib\/usg\/ohifLaunch/);
  });

  it("AppShell opens PACS through the resolver, not a stored constant", () => {
    const src = read("src/components/studio/AppShell.tsx");
    expect(src).toContain("fetchOhifStatus");
    expect(src).toContain("pickOhifEndpoint");
    expect(src).toContain("buildOhifWorklistUrl");
  });

  it("the embedded viewer builds its src through the shared builder", () => {
    const src = read("src/components/studio/usg/UsgViewerSidebar.tsx");
    expect(src).toContain("buildOhifViewerUrl");
    expect(src).toContain("fetchOhifStatus");
  });

  it("the PACS queue viewer button uses the shared builder", () => {
    const src = read("src/components/studio/usg/UsgPacsQueue.tsx");
    expect(src).toContain("buildOhifViewerUrl");
  });

  it("AUTO is not a page-protocol guess", () => {
    // The regression was literally: https page → Tailscale, http page → LAN.
    const src = code(read("src/lib/usg/ohifLaunch.ts"));
    expect(src).not.toMatch(/location\.protocol\s*===\s*["']https:["']\s*\?/);
    const resolver = read("src/lib/usg/ohifResolver.ts");
    expect(resolver).toMatch(/probe/i);
  });
});

describe("OHIF settings are the single source", () => {
  it("the boot-time cleanup can never wipe the viewer settings again", () => {
    // scripts/usg-v4-cleanup.mjs runs on every container start, BEFORE
    // `prisma db push`, and ALTER TABLE … DROP COLUMN on any name it lists.
    // A restored setting that stays listed there silently loses its value at
    // every restart — which is how the OHIF integration vanished once already.
    const src = readFileSync("scripts/usg-v4-cleanup.mjs", "utf8");
    const list = /const LEGACY_SETTINGS_COLUMNS = \[([\s\S]*?)\];/.exec(src);
    expect(list, "LEGACY_SETTINGS_COLUMNS not found").toBeTruthy();
    const body = list![1];
    expect(body).not.toMatch(/["'`]ohifLanUrl["'`]/);
    expect(body).not.toMatch(/["'`]ohifTailscaleUrl["'`]/);
    expect(body).not.toMatch(/["'`]ohifCustomUrl["'`]/);
    expect(body).not.toMatch(/["'`]ohifMode["'`]/);
    // The genuinely dead MRI columns must stay listed, or v4 stops cleaning.
    expect(body).toMatch(/radiologistName/);
  });

  it("the schema declares every field the resolver reads", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    for (const field of ["ohifMode", "ohifLanUrl", "ohifTailscaleUrl", "ohifCustomUrl"]) {
      expect(schema).toContain(`${field}  `);
    }
  });

  it("deployment still supplies the OHIF defaults the app reads", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    for (const env of ["OHIF_LAN_URL", "OHIF_TAILSCALE_URL", "OHIF_CUSTOM_URL", "OHIF_MODE"]) {
      expect(compose).toContain(env);
    }
  });
});

// ── The clinic's HTTPS viewer origin is deployment configuration, not code ──
//
// An https studio page can only frame an https viewer, and which origin that is
// stays a fact about one deployment. It belongs in docker-compose.yml (one
// place, overridable from .env) — never in a launch path, where a second copy
// would silently win over a saved Settings value the next time the viewer moves.

/** Every file under a source directory (no build output, no node_modules). */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("the canonical OHIF endpoint stays in deployment configuration", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");
  const defaulted = /OHIF_CUSTOM_URL=\$\{OHIF_CUSTOM_URL:-([^}]*)\}/.exec(compose);

  it("ships an HTTPS origin, so AUTO has a route an https page may embed", () => {
    expect(defaulted, "docker-compose.yml must give OHIF_CUSTOM_URL a default").toBeTruthy();
    expect(defaulted![1]).toMatch(/^https:\/\/[^\s}]+$/);
  });

  it("does not duplicate that origin anywhere in application source", () => {
    // Read out of compose rather than restated here, so this guard cannot
    // itself become the second copy it is checking for.
    const host = new URL(defaulted![1]).hostname;
    const hits = walk("src").filter((file) => readFileSync(file, "utf8").includes(host));
    expect(hits).toEqual([]);
  });

  it("ships no tailnet default, because a .ts.net name resolves only in the tailnet", () => {
    // The regression: an unreachable-by-DNS hostname as the only HTTPS
    // candidate left AUTO with no embeddable route, so the iframe went blank.
    const ts = /OHIF_TAILSCALE_URL=\$\{OHIF_TAILSCALE_URL:-([^}]*)\}/.exec(compose);
    expect(ts, "OHIF_TAILSCALE_URL must stay declared").toBeTruthy();
    expect(ts![1]).toBe("");
    expect(compose).not.toContain("tail7005c0");
  });

  it("prefers the canonical origin over the tailnet in AUTO order", () => {
    // AUTO walks LAN → custom → Tailscale, so a saved canonical HTTPS endpoint
    // wins without the studio ever touching the tailnet.
    const resolver = readFileSync("src/lib/usg/ohifResolver.ts", "utf8");
    expect(resolver).toMatch(/\[\s*"lan",\s*"custom",\s*"tailscale"\s*\]/);
  });

  it("leaves the LAN route derived from the clinic host, not a literal", () => {
    expect(compose).toMatch(/OHIF_LAN_URL=\$\{OHIF_LAN_URL:-\}/);
  });

  it("keeps a saved Settings value above that deployment default", () => {
    const settings = readFileSync("src/lib/settings.ts", "utf8");
    // saved → env → built-in fallback, unchanged by the new default…
    expect(settings).toMatch(/if \(saved\.trim\(\)\) return fix\(saved\);/);
    expect(settings).toMatch(/return fix\(envOverride\(envName\) \|\| fallback\);/);
    // …and there is no built-in Tailscale fallback to compete with it, so the
    // compose value is the only default an unsaved install sees.
    const lanDefaults = /const LAN_DEFAULTS = \{([\s\S]*?)\} as const;/.exec(settings);
    expect(lanDefaults, "LAN_DEFAULTS block not found").toBeTruthy();
    expect(lanDefaults![1]).not.toMatch(/[Tt]ailscale/);
  });
});
