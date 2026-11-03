import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url));
const source = readFileSync(tokensPath, "utf8");

type Block = Map<string, string>;

function readBlock(start: string, from = 0): { block: Block; end: number; start: number } {
  const marker = source.indexOf(start, from);
  if (marker < 0) throw new Error(`Missing token block: ${start}`);
  const open = source.indexOf("{", marker);
  let depth = 0;
  let close = -1;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }
  if (close < 0) throw new Error(`Unclosed token block: ${start}`);
  const body = source.slice(open + 1, close);
  const block: Block = new Map();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    block.set(match[1]!, match[2]!.replace(/\s+/g, " ").trim());
  }
  return { block, end: close, start: marker };
}

const light = readBlock(":root {").block;
const darkMediaStart = source.indexOf("@media (prefers-color-scheme: dark)");
if (darkMediaStart < 0) throw new Error("Missing OS dark block");
const darkMedia = readBlock(':root:not([data-theme="light"])', darkMediaStart).block;
const darkExplicit = readBlock(':root[data-theme="dark"]', darkMediaStart).block;
const printBlock = readBlock("@media print", darkMediaStart).block;

function channels(value: string): { r: number; g: number; b: number; a: number } | null {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const raw = hex[1]!;
    const expanded =
      raw.length === 3 || raw.length === 4
        ? raw.split("").map((part) => part + part).join("")
        : raw;
    const r = Number.parseInt(expanded.slice(0, 2), 16);
    const g = Number.parseInt(expanded.slice(2, 4), 16);
    const b = Number.parseInt(expanded.slice(4, 6), 16);
    const a = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  return null;
}

function luminance(value: string): number {
  const parsed = channels(value);
  if (!parsed) throw new Error(`Not a colour: ${value}`);
  const linear = (channel: number) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(parsed.r) + 0.7152 * linear(parsed.g) + 0.0722 * linear(parsed.b);
}

function composite(foreground: string, background: string): { r: number; g: number; b: number } {
  const fg = channels(foreground);
  const bg = channels(background);
  if (!fg || !bg) throw new Error(`Not a colour pair: ${foreground} / ${background}`);
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  };
}

function contrast(foreground: string, background: string): number {
  const effective = channels(foreground)?.a === 1 ? foreground : toHex(composite(foreground, background));
  const lightLum = Math.max(luminance(effective), luminance(background));
  const darkLum = Math.min(luminance(effective), luminance(background));
  return (lightLum + 0.05) / (darkLum + 0.05);
}

function toHex(value: { r: number; g: number; b: number }): string {
  return `#${[value.r, value.g, value.b]
    .map((part) => Math.round(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function token(block: Block, name: string): string {
  const value = block.get(name);
  if (!value) throw new Error(`Missing token ${name}`);
  return value;
}

type Pair = [foreground: string, background: string, threshold?: number];

const TEXT_PAIRS: Pair[] = [
  ["--ink", "--bg"],
  ["--ink", "--surface"],
  ["--ink", "--surface-2"],
  ["--ink-2", "--bg"],
  ["--ink-2", "--surface"],
  ["--ink-2", "--surface-2"],
  ["--muted", "--bg"],
  ["--muted", "--surface"],
  ["--muted", "--surface-2"],
  ["--link", "--bg"],
  ["--link", "--surface"],
  ["--primary", "--bg"],
  ["--on-primary", "--primary"],
  ["--on-primary", "--primary-hover"],
  ["--on-cta", "--cta"],
  ["--on-cta", "--cta-hover"],
  ["--chip-ink", "--chip-bg"],
  ["--on-correct", "--correct"],
  ["--on-wrong", "--wrong"],
  ["--on-review", "--review"],
  ["--on-not-visited", "--not-visited"],
  ["--footer-ink", "--footer-bg"],
  ["--footer-muted", "--footer-bg"],
  ["--danger-ink", "--danger-bg"],
  ["--success-ink", "--success-bg"],
  ["--warning-ink", "--warning-bg"],
  ["--exam-on-bar", "--exam-bar-from"],
  ["--exam-on-bar", "--exam-bar-mid"],
  ["--exam-subbar-ink", "--exam-subbar-bg"],
  ["--exam-palette-ink", "--exam-palette-bg"],
  ["--exam-section-ink", "--surface-2"],
];

const UI_PAIRS: Pair[] = [
  ["--focus", "--bg"],
  ["--focus", "--surface"],
  ["--focus", "--surface-2"],
  ["--border-input", "--bg"],
  ["--border-input", "--surface-2"],
  ["--exam-palette-border", "--exam-palette-bg"],
];

describe("design token parity", () => {
  it("defines every light token in both dark blocks", () => {
    for (const name of light.keys()) {
      expect(darkMedia.has(name), `OS dark block is missing ${name}`).toBe(true);
      expect(darkExplicit.has(name), `explicit dark block is missing ${name}`).toBe(true);
    }
  });

  it("does not add dark-only tokens that light mode cannot resolve", () => {
    for (const name of darkMedia.keys()) {
      expect(light.has(name), `light block is missing ${name}`).toBe(true);
    }
  });

  it("keeps the OS dark block and the explicit dark block identical", () => {
    for (const [name, value] of darkMedia) {
      expect(darkExplicit.get(name), `explicit dark block is missing ${name}`).toBe(value);
    }
  });

  it("overrides every colour token in the print token set", () => {
    const colourTokens = [...light.keys()].filter(
      (name) => !name.startsWith("--palette-") && channels(token(light, name)),
    );
    for (const name of colourTokens) {
      expect(printBlock.has(name), `print block is missing ${name}`).toBe(true);
    }
  });

  it("keeps the three theme blocks declarative and free of nested selectors", () => {
    for (const block of [light, darkMedia, darkExplicit]) {
      for (const value of block.values()) {
        expect(value).not.toContain("@media");
        expect(value).not.toContain(":root");
      }
    }
  });
});

describe.each([
  ["light", light],
  ["dark", darkMedia],
])("WCAG contrast in %s theme", (label, block) => {
  it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (foreground, background) => {
    const ratio = contrast(token(block, foreground), token(block, background));
    expect(ratio, `${label}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s on %s reaches 3:1", (foreground, background) => {
    const ratio = contrast(token(block, foreground), token(block, background));
    expect(ratio, `${label}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
  });
});
