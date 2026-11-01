/**
 * Dead weight stays out.
 *
 * The shadcn template installs ~46 UI primitives and ~70 packages whether or not
 * the app uses them, and every one of them is then in `npm ci`, in the image, and
 * in the supply chain the clinic trusts. This suite was written after the sweep
 * that removed 31 unused `src/components/ui/*` modules and 40 unused dependencies
 * (1058 → 655 packages in the lockfile); it is what keeps the tree from filling
 * back up with the next `npx shadcn add`.
 *
 * Both invariants are measured from the files themselves, not from `git grep`, so
 * a shallow CI checkout and a linked worktree give the same answer.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

/** Places a real consumer can live: app code, tests, scripts, root config. */
const SCAN_DIRS = ["src", "tests", "scripts"];
const SCAN_FILES = ["tailwind.config.ts", "next.config.ts", "postcss.config.mjs", "vitest.config.ts"];

/** `dir` is absolute — resolving it against ROOT again on every recursion step
 *  is how a first draft of this file scanned nothing and called every package dead. */
function walk(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".tmp") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

const files: string[] = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d);
  if (existsSync(abs)) walk(abs, files);
}
for (const f of SCAN_FILES) if (existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));

const bodies = files.map((f) => ({
  rel: path.relative(ROOT, f).replace(/\\/g, "/"),
  text: readFileSync(f, "utf8"),
}));

/**
 * A package or module path counts as used when it appears as a module specifier:
 * quoted, and either closing there or continuing into a subpath. Matching the
 * quoted form as a plain substring is deliberately dumb — it catches static,
 * side-effect and dynamic `import("x")` alike, and cannot mis-escape a scoped
 * name the way a generated regular expression does.
 */
function references(spec: string): string[] {
  const forms = [`"${spec}"`, `"${spec}/`, `'${spec}'`, `'${spec}/`, "`" + spec + "`", "`" + spec + "/"];
  return bodies.filter((b) => forms.some((f) => b.text.includes(f))).map((b) => b.rel);
}

const UI_DIR = "src/components/ui";
const uiModules = existsSync(path.join(ROOT, UI_DIR))
  ? readdirSync(path.join(ROOT, UI_DIR))
      .filter((f) => /\.(tsx|ts)$/.test(f))
      .map((f) => f.replace(/\.(tsx|ts)$/, ""))
  : [];

describe("no UI primitive ships that nothing renders", () => {
  it("the scan actually reads the tree", () => {
    // Both guards below pass on an empty scan, and this file shipped once that
    // way: it reported all 15 surviving primitives and 13 packages as dead.
    expect(bodies.length).toBeGreaterThan(100);
    expect(references("react").length).toBeGreaterThan(0);
  });

  it("every module under src/components/ui has a consumer outside src/components/ui", () => {
    const orphans: string[] = [];
    for (const m of uiModules) {
      const users = references(`@/components/ui/${m}`).filter((f) => !f.startsWith(`${UI_DIR}/`));
      if (users.length === 0) orphans.push(m);
    }
    expect(orphans).toEqual([]);
  });

  it("the sweep left a tree behind to guard", () => {
    // Without this, deleting every primitive would make the guard above pass.
    expect(uiModules.length).toBeGreaterThan(10);
  });
});

/**
 * Dependencies the framework or the container entrypoint needs that no source
 * file imports. Each has been checked by hand, so writing a name here is the
 * signal that a package is being kept on faith — say why next to it.
 */
const IMPLICIT: Record<string, string> = {
  // Next renders the client tree through it; no app file imports react-dom.
  "react-dom": "React DOM renderer, loaded by Next itself",
  // The CLI the entrypoint runs on boot (`prisma db push`) and the `db:*`
  // scripts. It is a binary, not an import.
  prisma: "entrypoint runs `prisma db push`; npm scripts use the CLI",
};

describe("the manifest carries only what the app uses", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies);

  it("every runtime dependency is imported somewhere, or excused with a reason", () => {
    const dead = deps.filter((d) => !IMPLICIT[d] && references(d).length === 0);
    expect(dead).toEqual([]);
  });

  it("an excuse is not left over a package that has gone", () => {
    // If react-dom or prisma is ever dropped, its entry has to go with it —
    // otherwise the list grows a hole through which the next unused package is
    // excused without anyone noticing.
    for (const name of Object.keys(IMPLICIT)) {
      expect(deps, `${name} is excused but is not a dependency`).toContain(name);
    }
  });

  it("the pruned manifest is the one that built the shipped bundle", () => {
    // 30 is where the sweep left it. A climb means someone added a dependency
    // the guard above tolerates by moving it into IMPLICIT.
    expect(deps.length).toBeLessThanOrEqual(30);
  });
});
