import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../src", import.meta.url));
const tokensFile = join(root, "styles", "tokens.css");
const extensions = new Set([".astro", ".css", ".ts", ".tsx", ".js", ".jsx"]);
const colourPattern = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (extensions.has(path.slice(path.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

/** Literal colours that are permitted because the platform requires a value. */
function allowed(relativePath: string, line: string): boolean {
  if (line.includes('name="theme-color"')) return true;
  if (relativePath === "pages/login.astro" && line.includes("<svg")) return true;
  return false;
}

describe("colour leak guard", () => {
  it("keeps literal colours inside tokens.css", () => {
    const leaks: string[] = [];
    for (const file of walk(root)) {
      if (file === tokensFile) continue;
      const relativePath = relative(root, file).split(sep).join("/");
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!colourPattern.test(line)) return;
        if (allowed(relativePath, line)) return;
        leaks.push(`${relativePath}:${index + 1}  ${line.trim()}`);
      });
    }
    expect(leaks, `Move these values into src/styles/tokens.css:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("uses the shared brand asset instead of recolouring a text badge", () => {
    const brand = readFileSync(join(root, "components", "BrandLogo.astro"), "utf8");
    expect(brand).toContain('src="/logo.svg"');
    expect(brand).not.toContain(">CF<");
  });
});
