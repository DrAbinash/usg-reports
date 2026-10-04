/**
 * Guard: the toast renderer that is MOUNTED must be the one the app EMITS to.
 *
 * Regression this prevents: src/app/layout.tsx mounted the shadcn/radix
 * <Toaster/> (fed by hooks/use-toast) while all 29 studio modules emitted
 * through `toast` from sonner. Sonner only paints when its own <Toaster/> is
 * mounted, so every save confirmation, every "Finalize failed", and every
 * endpoint error was published into a store nothing rendered — the app looked
 * healthy while reporting nothing to the doctor.
 *
 * Source-text assertions on purpose: the property is "the renderer in the tree
 * matches the emitter in the code", which no runtime test of a single function
 * can express.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(p, "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const LAYOUT = "src/app/layout.tsx";

describe("the mounted toast renderer is the one the app emits to", () => {
  it("layout.tsx mounts a Toaster", () => {
    expect(read(LAYOUT)).toMatch(/<Toaster(\s[^>]*)?\/>/);
  });

  it("layout.tsx mounts the sonner Toaster, not the shadcn one", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(/from ["']@\/components\/ui\/sonner["']|from ["']sonner["']/);
    expect(src).not.toMatch(/from ["']@\/components\/ui\/toaster["']/);
  });

  it("nothing imports the renderer that no emitter uses", () => {
    // The trap: two Toaster components with the same name, only one wired up.
    const hits = walk("src")
      .filter((f) => /\.(ts|tsx)$/.test(f) && statSync(f).isFile())
      .filter((f) => {
        const src = read(f);
        return (
          /from ["']@\/components\/ui\/toaster["']/.test(src) ||
          /from ["']@\/hooks\/use-toast["']/.test(src)
        );
      });
    expect(hits).toEqual([]);
  });

  it("the studio emits through sonner, so the mount above is load-bearing", () => {
    const emitters = walk("src").filter(
      (f) => /\.tsx?$/.test(f) && statSync(f).isFile() && /from ["']sonner["']/.test(read(f)),
    );
    expect(emitters.length).toBeGreaterThan(20);
  });
});
